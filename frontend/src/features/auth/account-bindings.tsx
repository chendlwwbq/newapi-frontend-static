'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { User } from '@/lib/api/types'
import type { CustomOAuthBinding } from '@/lib/oauth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { SecurityDialog } from './secure-verification/security-dialog'
import type { VerificationOperation } from './secure-verification/types'
import { createOAuthAuthorization } from './oauth'
import { openOAuthPopup, type OAuthPopupExchange } from './lib/oauth-popup'
import { useAuthStatus } from './use-auth-status'

type SecurityResult = { notification_warning?: boolean }
type Profile = User & { github_id?: string; discord_id?: string; oidc_id?: string; linux_do_id?: string; telegram_id?: string; wechat_id?: string }
interface EmailFlow extends SecurityResult {
  flow_token: string
  email: string
  current_email?: string
  old_email_required: boolean
  expires_at: number
  resend_at: number
}
type BindingAction = { operation: VerificationOperation; provider?: string; providerId?: number; wechatCode?: string }

function EmailBinding({ onClose, onSuccess }: { onClose: () => void; onSuccess: (result: SecurityResult) => Promise<void> }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(''),
    [flow, setFlow] = useState<EmailFlow | null>(null),
    [newCode, setNewCode] = useState(''),
    [oldCode, setOldCode] = useState(''),
    [verify, setVerify] = useState<string | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [terminal, setTerminal] = useState(false),
    [now, setNow] = useState(Date.now())
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!flow) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [flow])
  const expired = !!flow && (now / 1000 >= flow.expires_at || terminal)
  async function start(proof: string, signal: AbortSignal) {
    const result = await api<EmailFlow>('/api/oauth/email/bind/start', {
      method: 'POST',
      signal,
      headers: { 'X-Security-Proof': proof },
      body: { email: verify },
    })
    signal.throwIfAborted()
    setFlow(result)
    setNow(Date.now())
    setError('')
    setNewCode('')
    setOldCode('')
    if (result.notification_warning) toast.warning(t('The change succeeded, but the notification email could not be sent.'))
  }
  async function finish(resend = false) {
    if (!flow || expired || request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      if (resend) {
        const next = await api<EmailFlow>('/api/oauth/email/bind/resend', {
          method: 'POST',
          signal: controller.signal,
          body: { flow_token: flow.flow_token },
        })
        controller.signal.throwIfAborted()
        setFlow(next)
        setNow(Date.now())
        setNewCode('')
        setOldCode('')
        toast.success(t('Verification code sent! Please check your email.'))
      } else {
        const result = await api<SecurityResult>('/api/oauth/email/bind', {
          method: 'POST',
          signal: controller.signal,
          body: { flow_token: flow.flow_token, new_code: newCode.trim(), old_code: oldCode.trim() },
        })
        controller.signal.throwIfAborted()
        await onSuccess(result)
        onClose()
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError((failure as Error).message)
        if (
          failure instanceof ApiError &&
          ['EMAIL_BINDING_LOCKED', 'AUTH_FLOW_INVALID', 'ACCOUNT_SECURITY_STATE_CHANGED', 'EMAIL_BINDING_DELIVERY_FAILED'].includes(
            failure.code || ''
          )
        )
          setTerminal(true)
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!flow) setVerify(email.trim().toLowerCase())
    else void finish()
  }
  return (
    <>
      <Dialog
        open={!verify}
        onOpenChange={(open) => {
          if (!open && !busy) onClose()
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t('Bind Email')}</DialogTitle>
            <DialogDescription>{t('Verify the new email and, when required, your current email to finish this change.')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="admin-pricing-fields">
              <label className="field">
                <span>{t('Email')}</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={50}
                  value={flow?.email || email}
                  readOnly={!!flow}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {flow && (
                <>
                  <p className="small-note">
                    {t('Expires')}: {Math.max(0, Math.ceil(flow.expires_at - now / 1000))} s
                  </p>
                  {flow.old_email_required && (
                    <label className="field">
                      <span>{t('Current email verification code')}</span>
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        value={oldCode}
                        onChange={(event) => setOldCode(event.target.value)}
                      />
                    </label>
                  )}
                  <label className="field">
                    <span>{t('New email verification code')}</span>
                    <input
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={newCode}
                      onChange={(event) => setNewCode(event.target.value)}
                    />
                  </label>
                  <Button type="button" variant="outline" disabled={expired || now / 1000 < flow.resend_at} onClick={() => finish(true)}>
                    {t('Resend')} {now / 1000 < flow.resend_at ? Math.ceil(flow.resend_at - now / 1000) : ''}
                  </Button>
                </>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {t(error)}
                </p>
              )}
              {expired ? (
                <Button
                  type="button"
                  onClick={() => {
                    setFlow(null)
                    setTerminal(false)
                    setNewCode('')
                    setOldCode('')
                    setError('')
                  }}
                >
                  {t('Start again')}
                </Button>
              ) : (
                <Button type="submit" disabled={busy}>
                  {t(flow ? 'Confirm' : 'Verify and continue')}
                </Button>
              )}
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
      {verify && (
        <SecurityDialog
          operation={{ scope: 'account.binding.bind', context: { provider: 'email', email: verify } }}
          title="Bind Email"
          onAuthorized={start}
          onClose={() => setVerify(null)}
        />
      )}
    </>
  )
}

export function AccountBindings() {
  const { bundle } = useAuth()
  return bundle ? <AccountBindingsContent key={`${bundle.user.id}:${bundle.session.sid}`} /> : null
}
function AccountBindingsContent() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    status = useAuthStatus()
  const self = useQuery({ queryKey: ['self', bundle?.user.id], queryFn: ({ signal }) => api<Profile>('/api/user/self', { signal }) })
  const bindings = useQuery({
    queryKey: ['oauth-bindings', bundle?.user.id],
    queryFn: ({ signal }) => api<CustomOAuthBinding[]>('/api/user/oauth/bindings', { signal }),
  })
  const [emailOpen, setEmailOpen] = useState(false),
    [wechatOpen, setWechatOpen] = useState(false),
    [wechatCode, setWechatCode] = useState(''),
    [action, setAction] = useState<BindingAction | null>(null)
  const [prepared, setPrepared] = useState<{ provider: string; state: string; url: string } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function changed(result: SecurityResult) {
    if (result.notification_warning) toast.warning(t('The change succeeded, but the notification email could not be sent.'))
    else toast.success(t('Saved'))
    await Promise.all([queries.invalidateQueries({ queryKey: ['self'] }), queries.invalidateQueries({ queryKey: ['oauth-bindings'] })])
  }
  async function authorized(proof: string, signal: AbortSignal) {
    if (!action || !status.data) return
    if (action.provider) {
      const next = await createOAuthAuthorization(action.provider, 'bind', status.data, signal, undefined, proof)
      signal.throwIfAborted()
      setPrepared({ provider: action.provider, ...next })
    } else if (action.wechatCode) {
      const result = await api<SecurityResult>('/api/oauth/wechat/bind', {
        method: 'POST',
        headers: { 'X-Security-Proof': proof },
        body: { code: action.wechatCode },
        signal,
      })
      signal.throwIfAborted()
      setWechatCode('')
      setWechatOpen(false)
      await changed(result)
    } else {
      const result = await api<SecurityResult>(`/api/user/oauth/bindings/${action.providerId}`, {
        method: 'DELETE',
        signal,
        headers: { 'X-Security-Proof': proof },
      })
      signal.throwIfAborted()
      await changed(result)
    }
  }
  async function complete() {
    if (!prepared || request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    let exchange: OAuthPopupExchange | undefined
    try {
      exchange = await openOAuthPopup({ provider: prepared.provider, intent: 'bind', signal: controller.signal, prepare: async () => prepared })
      const callback = exchange.callback
      const result = await api<SecurityResult>(
        `/api/oauth/${encodeURIComponent(prepared.provider)}?${new URLSearchParams({ state: callback.state, ...(callback.code ? { code: callback.code } : {}), ...(callback.error ? { error: callback.error } : {}), ...(callback.errorDescription ? { error_description: callback.errorDescription } : {}) })}`,
        { signal: exchange.signal }
      )
      exchange.signal.throwIfAborted()
      exchange.finish({ success: true })
      setPrepared(null)
      await changed(result)
    } catch (failure) {
      exchange?.finish({ success: false, message: (failure as Error).message })
      if (!controller.signal.aborted) {
        setError((failure as Error).message)
        setPrepared(null)
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }
  const loadError = self.error || status.error || bindings.error
  if (loadError)
    return (
      <ErrorState
        error={loadError}
        retry={() => {
          void self.refetch()
          void status.refetch()
          void bindings.refetch()
        }}
      />
    )
  if (!self.data || !status.data || !bindings.data) return <LoadingState />
  const config = status.data,
    user = self.data
  const providers = [
    { slug: 'github', name: 'GitHub', enabled: config.github_oauth, value: user.github_id },
    { slug: 'discord', name: 'Discord', enabled: config.discord_oauth, value: user.discord_id },
    { slug: 'oidc', name: config.oidc_display_name || 'OIDC', enabled: config.oidc_enabled, value: user.oidc_id },
    { slug: 'linuxdo', name: 'LinuxDO', enabled: config.linuxdo_oauth, value: user.linux_do_id },
    { slug: 'telegram', name: 'Telegram', enabled: config.telegram_oauth, value: user.telegram_id },
  ].filter((provider) => provider.enabled || provider.value)
  const locked = busy || !!prepared || !!action || emailOpen || wechatOpen
  return (
    <section className="console-panel">
      <h2>{t('Account Bindings')}</h2>
      {error && (
        <p className="inline-error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="binding-grid">
        <article>
          <div>
            <strong>{t('Email')}</strong>
            <p className="small-note">{user.email || t('Not bound')}</p>
          </div>
          <Button variant="outline" disabled={locked} onClick={() => setEmailOpen(true)}>
            {t(user.email ? 'Change' : 'Bind')}
          </Button>
        </article>
        {(config.wechat_login || user.wechat_id) && (
          <article>
            <div>
              <strong>{t('WeChat')}</strong>
              <p className="small-note">{t(user.wechat_id ? 'Bound' : 'Not bound')}</p>
            </div>
            <Button variant="outline" disabled={locked || !!user.wechat_id || !config.wechat_login} onClick={() => setWechatOpen(true)}>
              {t(user.wechat_id ? 'Bound' : 'Bind')}
            </Button>
          </article>
        )}
        {providers.map((provider) => (
          <article key={provider.slug}>
            <div>
              <strong>{provider.name}</strong>
              <p className="small-note">{provider.value || t('Not bound')}</p>
            </div>
            <Button
              variant="outline"
              disabled={locked || !!provider.value || !provider.enabled}
              onClick={() =>
                setAction({ provider: provider.slug, operation: { scope: 'account.binding.bind', context: { provider: provider.slug } } })
              }
            >
              {t(provider.value ? 'Bound' : 'Bind')}
            </Button>
          </article>
        ))}
        {(config.custom_oauth_providers || []).map((provider) => {
          const binding = bindings.data.find((item) => item.provider_id === provider.id)
          return (
            <article key={provider.id}>
              <div>
                <strong>{provider.name}</strong>
                <p className="small-note">{binding?.provider_user_id || t('Not bound')}</p>
              </div>
              <Button
                variant="outline"
                disabled={locked}
                onClick={() =>
                  setAction(
                    binding
                      ? { providerId: provider.id, operation: { scope: 'account.binding.unbind', context: { provider_id: provider.id } } }
                      : { provider: provider.slug, operation: { scope: 'account.binding.bind', context: { provider: provider.slug } } }
                  )
                }
              >
                {t(binding ? 'Unbind' : 'Bind')}
              </Button>
            </article>
          )
        })}
      </div>
      {emailOpen && <EmailBinding onClose={() => setEmailOpen(false)} onSuccess={changed} />}
      <Dialog
        open={wechatOpen && !action}
        onOpenChange={(open) => {
          if (!open) {
            setWechatOpen(false)
            setWechatCode('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Bind WeChat')}</DialogTitle>
            <DialogDescription>{t('Enter the verification code')}</DialogDescription>
          </DialogHeader>
          {typeof config.wechat_qrcode === 'string' && /^https?:\/\//.test(config.wechat_qrcode) && (
            <img className="binding-qr" src={config.wechat_qrcode} alt={t('WeChat login QR code')} />
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const code = wechatCode.trim()
              setAction({ wechatCode: code, operation: { scope: 'account.binding.bind', context: { provider: 'wechat', code } } })
            }}
          >
            <label className="field">
              <span>{t('Verification code')}</span>
              <input
                autoComplete="one-time-code"
                required
                maxLength={128}
                value={wechatCode}
                onChange={(event) => setWechatCode(event.target.value)}
              />
            </label>
            <Button type="submit">{t('Verify and continue')}</Button>
          </form>
        </DialogContent>
      </Dialog>
      {action && (
        <SecurityDialog
          operation={action.operation}
          title={action.providerId ? 'Confirm Unbind' : 'Continue account binding'}
          onAuthorized={authorized}
          onClose={() => setAction(null)}
        />
      )}
      <Dialog
        open={!!prepared}
        onOpenChange={(open) => {
          if (!open && !busy) setPrepared(null)
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t('Continue account binding')}</DialogTitle>
            <DialogDescription>{t('Your identity has been verified. Continue to the provider to finish linking your account.')}</DialogDescription>
          </DialogHeader>
          <p className="small-note">{prepared?.provider}</p>
          <Button disabled={busy} onClick={complete}>
            {t(busy ? 'Loading' : 'Continue')}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
