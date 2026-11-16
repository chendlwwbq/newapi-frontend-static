'use client'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/copy-button'
import { api } from '@/lib/api/client'
import { AuthShell } from './auth-shell'
import { Turnstile } from './turnstile'
import { useAuthStatus } from './use-auth-status'

export function RecoveryPage() {
  const { t } = useTranslation(),
    status = useAuthStatus()
  const [email, setEmail] = useState(''),
    [token, setToken] = useState(''),
    [captcha, setCaptcha] = useState(0)
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/api/reset_password?${new URLSearchParams({ email, turnstile: token })}`, { anonymous: true })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setToken('')
      setCaptcha((value) => value + 1)
    }
  }
  return (
    <AuthShell>
      <h1>{t('Reset password')}</h1>
      <p>{t('Enter the email address linked to your account.')}</p>
      {sent ? (
        <p role="status" className="auth-notice">
          {t('If this email is linked to an account, a reset link will be sent. Check your inbox.')}
        </p>
      ) : (
        <form onSubmit={submit}>
          <label className="field">
            <span>{t('Email')}</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          {status.data?.turnstile_check && <Turnstile key={captcha} siteKey={status.data.turnstile_site_key || ''} onToken={setToken} />}
          {(error || status.error) && (
            <p className="inline-error" role="alert">
              {t(error || status.error!.message)}
            </p>
          )}
          <Button type="submit" className="auth-submit" disabled={busy || !status.data || (!!status.data.turnstile_check && !token)}>
            {t(busy ? 'Loading' : 'Send reset link')}
          </Button>
        </form>
      )}
      <p className="auth-switch">
        <Link href="/sign-in">{t('Back to sign in')}</Link>
      </p>
    </AuthShell>
  )
}

// The native New API reset endpoint generates a password; it does not accept one.
// Keep the generated password in this component only and require an explicit reset.
export function ResetPasswordPage({ email, token }: { email: string; token: string }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function reset() {
    setBusy(true)
    setError('')
    try {
      const generated = await api<string>('/api/user/reset', { anonymous: true, method: 'POST', body: { email, token } })
      window.history.replaceState(null, '', window.location.pathname)
      setPassword(generated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthShell>
      <h1>{t(password ? 'Password reset complete' : 'Reset password')}</h1>
      {password ? (
        <>
          <p>{t('Save this password now. It is shown only on this page. Sign in and change it in Security.')}</p>
          <div className="recovery-secret">
            <code>{password}</code>
            <CopyButton value={password} />
          </div>
          <Link className="pill-button" href="/sign-in">
            {t('Sign in')}
          </Link>
        </>
      ) : (
        <>
          <p>{t('Confirm to generate a new password using your reset link.')}</p>
          {!email || !token ? (
            <p className="inline-error">{t('Password reset link is invalid or has expired')}</p>
          ) : (
            <Button className="auth-submit" disabled={busy} onClick={reset}>
              {t(busy ? 'Loading' : 'Reset password')}
            </Button>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {t(error)}
            </p>
          )}
          <p className="auth-switch">
            <Link href="/forgot-password">{t('Request a new link')}</Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
