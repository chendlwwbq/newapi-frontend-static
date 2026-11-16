'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Fingerprint, KeyRound, Monitor, ShieldCheck, Smartphone } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { api } from '@/lib/api/client'
import type { User } from '@/lib/api/types'
import { acceptSessionRotation, clearSession, useAuth, type SessionRotation } from '@/lib/auth/session'
import { buildRegistrationResult, prepareCredentialCreationOptions } from '@/lib/passkey'
import { toIntlLocale } from '@/i18n/languages'
import { SecurityDialog } from './secure-verification/security-dialog'
import type { VerificationOperation } from './secure-verification/types'
import type { PasskeyOptionsPayload, PasskeyStatus } from './passkey/types'
import { SecurityNav } from './security-nav'
import { useAuthStatus } from './use-auth-status'

interface LoginSession {
  sid: string
  current: boolean
  login_method: string
  ip: string
  user_agent: string
  created_at: number
  last_active_at: number
  expires_at: number
}
interface TwoFAStatus {
  enabled: boolean
  locked: boolean
  backup_codes_remaining?: number
}
interface TwoFASetup {
  secret: string
  qr_code_data: string
  backup_codes: string[]
  flow_token: string
  expires_at: number
}
type Action = 'password' | '2fa.setup' | '2fa.disable' | '2fa.backup_codes.regenerate' | 'passkey.register' | 'passkey.delete'

export function SecurityPage() {
  const auth = useAuth(),
    router = useRouter(),
    queries = useQueryClient(),
    { t, i18n } = useTranslation(),
    status = useAuthStatus()
  const userId = auth.bundle!.user.id
  const self = useQuery({ queryKey: ['self', userId], queryFn: () => api<User>('/api/user/self') })
  const sessions = useQuery({ queryKey: ['security', userId, 'sessions'], queryFn: () => api<LoginSession[]>('/api/user/sessions') })
  const twoFA = useQuery({ queryKey: ['security', userId, '2fa'], queryFn: () => api<TwoFAStatus>('/api/user/2fa/status') })
  const passkey = useQuery({ queryKey: ['security', userId, 'passkey'], queryFn: () => api<PasskeyStatus>('/api/user/passkey') })
  const [action, setAction] = useState<Action | null>(null),
    [setup, setSetup] = useState<TwoFASetup | null>(null),
    [backupCodes, setBackupCodes] = useState<string[]>([])
  const [oldPassword, setOldPassword] = useState(''),
    [newPassword, setNewPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [code, setCode] = useState(''),
    [savedCodes, setSavedCodes] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [revoke, setRevoke] = useState<LoginSession | 'others' | null>(null)
  const user = self.data
  const date = (seconds: number | string) =>
    seconds ? new Date(typeof seconds === 'number' ? seconds * 1000 : seconds).toLocaleString(toIntlLocale(i18n.language)) : '—'
  async function refreshSecurity() {
    await Promise.all([queries.invalidateQueries({ queryKey: ['security', userId] }), queries.invalidateQueries({ queryKey: ['self', userId] })])
  }
  async function authorized(proof: string, signal: AbortSignal) {
    const headers = { 'X-Security-Proof': proof }
    if (action === '2fa.setup') {
      const enrollment = await api<TwoFASetup>('/api/user/2fa/setup', { method: 'POST', headers, signal })
      setSetup(enrollment)
      setSavedCodes(false)
      setCode('')
      setError('')
      return
    }
    let rotation: SessionRotation
    if (action === 'password') {
      rotation = await api('/api/user/self', {
        method: 'PUT',
        signal,
        headers,
        body: { username: user!.username, display_name: user!.display_name, password: newPassword, original_password: oldPassword },
      })
      setOldPassword('')
      setNewPassword('')
      setConfirm('')
    } else if (action === 'passkey.register') {
      const enrollment = await api<PasskeyOptionsPayload>('/api/user/passkey/register/begin', { method: 'POST', headers, signal, body: {} })
      const credential = await navigator.credentials.create({ publicKey: prepareCredentialCreationOptions(enrollment.options ?? enrollment), signal })
      signal.throwIfAborted()
      if (!credential) throw new Error('Passkey registration was cancelled')
      rotation = await api('/api/user/passkey/register/finish', {
        method: 'POST',
        signal,
        body: { flow_token: enrollment.flow_token, credential: buildRegistrationResult(credential as PublicKeyCredential) },
      })
    } else if (action === 'passkey.delete') {
      rotation = await api('/api/user/passkey', { method: 'DELETE', headers, signal })
    } else if (action === '2fa.backup_codes.regenerate') {
      const result = await api<SessionRotation & { backup_codes: string[] }>('/api/user/2fa/backup_codes', { method: 'POST', headers, signal })
      rotation = result
      setBackupCodes(result.backup_codes)
    } else {
      rotation = await api('/api/user/2fa/disable', { method: 'POST', headers, signal })
    }
    acceptSessionRotation(rotation)
    if (rotation.notification_warning) toast.warning(t('Saved, but the security notification email could not be delivered.'))
    else toast.success(t('Saved'))
    await refreshSecurity()
  }
  async function enableTwoFA(event: FormEvent) {
    event.preventDefault()
    if (!setup) return
    setBusy(true)
    setError('')
    try {
      if (setup.expires_at * 1000 <= Date.now()) throw new Error('Verification flow expired')
      const rotation = await api<SessionRotation>('/api/user/2fa/enable', {
        method: 'POST',
        body: { flow_token: setup.flow_token, code: code.trim() },
      })
      acceptSessionRotation(rotation)
      setBackupCodes(setup.backup_codes)
      setSetup(null)
      setCode('')
      await refreshSecurity()
      toast.success(t('Saved'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function changePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword !== confirm) {
      toast.error(t('Passwords do not match'))
      return
    }
    setAction('password')
  }
  async function revokeSessions() {
    if (!revoke) return
    setBusy(true)
    setError('')
    try {
      if (revoke === 'others') await api('/api/user/sessions/revoke-others', { method: 'POST' })
      else {
        const result = await api<{ current: boolean }>(`/api/user/sessions/${encodeURIComponent(revoke.sid)}`, { method: 'DELETE' })
        if (result.current) {
          clearSession()
          queries.clear()
          router.replace('/sign-in')
          return
        }
      }
      setRevoke(null)
      await queries.invalidateQueries({ queryKey: ['security', userId, 'sessions'] })
      toast.success(t('Session revoked'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (self.error) return <ErrorState error={self.error} />
  if (!user) return <LoadingState />
  const operation: VerificationOperation | null = action
    ? { scope: action === 'password' ? (user.has_password ? 'account.password.change' : 'account.password.set') : action }
    : null
  const actionLabel =
    action === 'password'
      ? 'Change password'
      : action === '2fa.setup'
        ? 'Enable two-factor authentication'
        : action === '2fa.disable'
          ? 'Disable two-factor authentication'
          : action === '2fa.backup_codes.regenerate'
            ? 'Regenerate backup codes'
            : action === 'passkey.register'
              ? 'Register Passkey'
              : 'Delete Passkey'
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Security')}</h1>
          <p>{t('Manage your password, authenticators and signed-in devices.')}</p>
        </div>
        <ShieldCheck size={28} />
      </div>
      <SecurityNav />
      <div className="security-grid">
        <section className="console-panel">
          <div className="security-section-heading">
            <KeyRound size={19} />
            <h2>{t('Password')}</h2>
          </div>
          <p className="small-note">{t('Changing your password signs out your other sessions.')}</p>
          <form onSubmit={changePassword}>
            {user.has_password && (
              <label className="field">
                <span>{t('Current password')}</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  required
                />
              </label>
            )}
            <label className="field">
              <span>{t('New password')}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                minLength={8}
                maxLength={128}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>{t('Confirm password')}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                minLength={8}
                maxLength={128}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </label>
            <Button type="submit">{t(user.has_password ? 'Change password' : 'Set password')}</Button>
          </form>
        </section>
        <div className="security-stack">
          <section className="console-panel">
            <div className="security-section-heading">
              <Smartphone size={19} />
              <h2>{t('Two-factor authentication')}</h2>
              <span className="security-status" data-enabled={twoFA.data?.enabled}>
                {t(twoFA.data?.enabled ? 'Enabled' : 'Disabled')}
              </span>
            </div>
            <p className="small-note">{t('Protect your account with an authenticator app and recovery codes.')}</p>
            {twoFA.isPending ? (
              <p>{t('Loading')}</p>
            ) : twoFA.error ? (
              <ErrorState error={twoFA.error} />
            ) : (
              <div className="security-actions">
                {twoFA.data?.enabled ? (
                  <>
                    <span className="small-note">
                      {t('Backup codes remaining')}: {twoFA.data.backup_codes_remaining ?? '—'}
                    </span>
                    <Button variant="outline" onClick={() => setAction('2fa.backup_codes.regenerate')}>
                      {t('Regenerate backup codes')}
                    </Button>
                    <Button variant="destructive" onClick={() => setAction('2fa.disable')}>
                      {t('Disable')}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setAction('2fa.setup')}>{t('Enable two-factor authentication')}</Button>
                )}
              </div>
            )}
          </section>
          <section className="console-panel">
            <div className="security-section-heading">
              <Fingerprint size={19} />
              <h2>{t('Passkey')}</h2>
              <span className="security-status" data-enabled={passkey.data?.enabled}>
                {t(passkey.data?.enabled ? 'Enabled' : 'Disabled')}
              </span>
            </div>
            <p className="small-note">{t('Sign in with your device lock, fingerprint or security key.')}</p>
            {passkey.isPending ? (
              <p>{t('Loading')}</p>
            ) : passkey.error ? (
              <ErrorState error={passkey.error} />
            ) : (
              <div className="security-actions">
                {passkey.data?.enabled ? (
                  <>
                    <span className="small-note">
                      {t('Last used')}: {date(passkey.data.last_used_at || 0)}
                    </span>
                    <Button variant="destructive" onClick={() => setAction('passkey.delete')}>
                      {t('Delete Passkey')}
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={!status.data?.passkey_login || typeof window === 'undefined' || !window.PublicKeyCredential}
                    onClick={() => setAction('passkey.register')}
                  >
                    {t('Register Passkey')}
                  </Button>
                )}
              </div>
            )}
            {status.data?.passkey_login === false && <p className="small-note">{t('Passkey is disabled by the administrator.')}</p>}
          </section>
        </div>
        <section className="console-panel security-sessions">
          <div className="security-section-heading">
            <Monitor size={19} />
            <h2>{t('Signed-in devices')}</h2>
            <Button
              variant="outline"
              disabled={!sessions.data?.some((session) => !session.current)}
              onClick={() => {
                setError('')
                setRevoke('others')
              }}
            >
              {t('Sign out other devices')}
            </Button>
          </div>
          {sessions.isPending ? (
            <LoadingState />
          ) : sessions.error ? (
            <ErrorState error={sessions.error} />
          ) : (
            <div className="session-list">
              {sessions.data?.map((session) => (
                <article key={session.sid} className="session-row">
                  <Monitor size={21} />
                  <div>
                    <strong>
                      {session.user_agent || t('Unknown device')}
                      {session.current && (
                        <span className="security-status" data-enabled>
                          {t('This device')}
                        </span>
                      )}
                    </strong>
                    <p>
                      {session.ip} · {session.login_method}
                    </p>
                    <p>
                      {t('Last active')}: {date(session.last_active_at)} · {t('Expires')}: {date(session.expires_at)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setError('')
                      setRevoke(session)
                    }}
                  >
                    {t('Sign out')}
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      {operation && <SecurityDialog operation={operation} title={actionLabel} onAuthorized={authorized} onClose={() => setAction(null)} />}
      <Dialog
        open={!!setup}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setSetup(null)
            setCode('')
            setError('')
          }
        }}
      >
        <DialogContent showCloseButton={!busy} className="security-dialog">
          <DialogHeader>
            <DialogTitle>{t('Set up authenticator')}</DialogTitle>
            <DialogDescription>{t('Scan the QR code in your authenticator app, save the backup codes, then enter its code.')}</DialogDescription>
          </DialogHeader>
          {setup && (
            <form onSubmit={enableTwoFA}>
              <div className="authenticator-qr">
                <QRCodeSVG value={setup.qr_code_data} size={176} marginSize={2} />
              </div>
              <div className="recovery-secret">
                <code>{setup.secret}</code>
                <CopyButton value={setup.secret} />
              </div>
              <p className="small-note">{t('Keep backup codes offline. Each code can be used once.')}</p>
              <div className="backup-codes">
                <pre>{setup.backup_codes.join('\n')}</pre>
                <CopyButton value={setup.backup_codes.join('\n')} />
              </div>
              <label className="auth-legal">
                <input type="checkbox" checked={savedCodes} onChange={(event) => setSavedCodes(event.target.checked)} required />
                {t('I have saved my backup codes.')}
              </label>
              <label className="field">
                <span>{t('Verification code')}</span>
                <input autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required />
              </label>
              {error && (
                <p className="inline-error" role="alert">
                  {t(error)}
                </p>
              )}
              <Button type="submit" className="auth-submit" disabled={busy || !savedCodes}>
                {t(busy ? 'Loading' : 'Enable')}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!backupCodes.length}
        onOpenChange={(open) => {
          if (!open) setBackupCodes([])
        }}
      >
        <DialogContent className="security-dialog">
          <DialogHeader>
            <DialogTitle>{t('Backup codes')}</DialogTitle>
            <DialogDescription>{t('Keep backup codes offline. Each code can be used once.')}</DialogDescription>
          </DialogHeader>
          <div className="backup-codes">
            <pre>{backupCodes.join('\n')}</pre>
            <CopyButton value={backupCodes.join('\n')} />
          </div>
          <Button onClick={() => setBackupCodes([])}>{t('I have saved my backup codes.')}</Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open && !busy) setRevoke(null)
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t('Sign out devices?')}</DialogTitle>
            <DialogDescription>
              {t(
                revoke !== 'others' && revoke?.current
                  ? 'This will sign you out of this browser.'
                  : 'Selected sessions will lose access. They must sign in again.'
              )}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="inline-error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="security-actions">
            <Button variant="outline" disabled={busy} onClick={() => setRevoke(null)}>
              {t('Cancel')}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={revokeSessions}>
              {t(busy ? 'Loading' : 'Sign out')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
