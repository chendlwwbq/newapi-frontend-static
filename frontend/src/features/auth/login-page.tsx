'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound, UserRound, LockKeyhole, Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AuthShell } from './auth-shell'
import { Turnstile } from './turnstile'
import { useAuthStatus } from './use-auth-status'
import { createOAuthAuthorization, availableOAuthProviders } from './oauth'
import { rememberOAuthLoginRedirect } from './lib/oauth-callback-mode'
import { requestPasskeyAssertion, rememberPasskeyRPID } from './passkey/assertion'
import { api } from '@/lib/api/client'
import { acceptSession } from '@/lib/auth/session'
import { passwordPayload } from '@/lib/auth/password'
import type { AuthBundle, Challenge } from '@/lib/api/types'

export function LoginPage({ returnTo = '/dashboard/overview', initialChallenge = null }: { returnTo?: string; initialChallenge?: Challenge | null }) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient()
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false)
  const [challenge, setChallenge] = useState<Challenge | null>(initialChallenge),
    [code, setCode] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [hydrated, setHydrated] = useState(false)
  const status = useAuthStatus(),
    controller = useRef<AbortController | null>(null)
  const [token, setToken] = useState(''),
    [captcha, setCaptcha] = useState(0),
    [rpID, setRPID] = useState(''),
    [domains, setDomains] = useState<string[]>([])
  useEffect(() => {
    setHydrated(true)
    return () => controller.current?.abort()
  }, [])
  function success(bundle: AuthBundle) {
    queries.clear()
    acceptSession(bundle)
    const safe = returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\') ? returnTo : '/dashboard/overview'
    router.replace(safe)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    controller.current = new AbortController()
    if (challenge && challenge.expires_at * 1000 <= Date.now()) {
      setError('Login flow expired. Please sign in again.')
      setBusy(false)
      return
    }
    try {
      const result = challenge
        ? await api<AuthBundle>('/api/user/login/verify', {
            anonymous: true,
            signal: controller.current.signal,
            method: 'POST',
            body: { flow_token: challenge.flow_token, code: code.trim(), method: '2fa' },
          })
        : await api<AuthBundle | Challenge>(`/api/user/login?${new URLSearchParams({ turnstile: token })}`, {
            anonymous: true,
            signal: controller.current.signal,
            method: 'POST',
            body: { username, ...(await passwordPayload(password)) },
          })
      if ('require_verification' in result) {
        setChallenge(result)
        setPassword('')
      } else success(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setToken('')
      setCaptcha((value) => value + 1)
    }
  }
  async function passkey() {
    setBusy(true)
    setError('')
    controller.current = new AbortController()
    try {
      if (challenge && challenge.expires_at * 1000 <= Date.now()) throw new Error('Login flow expired. Please sign in again.')
      const signal = controller.current.signal
      const assertion = await requestPasskeyAssertion(
        (selected) =>
          api(challenge ? '/api/user/login/passkey/begin' : '/api/user/passkey/login/begin', {
            anonymous: true,
            signal,
            method: 'POST',
            body: { ...(challenge ? { flow_token: challenge.flow_token } : {}), ...(selected ? { rp_id: selected } : {}) },
          }),
        signal,
        { rpID: rpID || undefined, onDomains: (info) => setDomains(info.rpIDs) }
      )
      const bundle = await api<AuthBundle>(challenge ? '/api/user/login/passkey/finish' : '/api/user/passkey/login/finish', {
        anonymous: true,
        signal,
        method: 'POST',
        body: challenge
          ? { flow_token: challenge.flow_token, passkey_flow_token: assertion.flowToken, credential: assertion.assertion }
          : { flow_token: assertion.flowToken, credential: assertion.assertion },
      })
      signal.throwIfAborted()
      rememberPasskeyRPID(assertion.rpID)
      success(bundle)
    } catch (err) {
      if (!controller.current?.signal.aborted) setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function oauth(provider: string) {
    if (!status.data) return
    setBusy(true)
    setError('')
    try {
      const authorization = await createOAuthAuthorization(provider, 'login', status.data)
      rememberOAuthLoginRedirect(authorization.state, returnTo)
      window.location.assign(authorization.url)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  const providers = status.data ? availableOAuthProviders(status.data) : []
  const canUsePassword = status.data?.password_login_enabled !== false
  const canUsePasskey =
    (!challenge && status.data?.passkey_login) || challenge?.methods.some((method) => method.method === 'passkey' && method.available)
  let submitLabel = t('Sign in')
  if (challenge) submitLabel = t('Continue')
  if (busy) submitLabel = t('Loading')
  return (
    <AuthShell>
      <form onSubmit={submit} aria-busy={busy}>
        <h1>{t(challenge ? 'Verify your identity' : 'Welcome back')}</h1>
        <p>{t('Sign in to manage API keys, usage and billing.')}</p>
        {status.error && (
          <p className="inline-error" role="alert">
            {t(status.error.message)}
          </p>
        )}
        {!challenge && !!providers.length && (
          <>
            {providers.length > 3 ? (
              <TooltipProvider>
                <div className="oauth-buttons grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {providers.map((provider) => (
                    <Tooltip key={provider.slug}>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            aria-label={provider.name}
                            onClick={() => oauth(provider.slug)}
                          />
                        }
                      >
                        {provider.slug === 'github' ? (
                          <img src="/orbis/home/github.svg" width={18} height={18} alt="" />
                        ) : (
                          <Building2 size={17} />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>{provider.name}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <div className="oauth-buttons">
                {providers.map((provider) => (
                  <Button key={provider.slug} type="button" variant="outline" disabled={busy} onClick={() => oauth(provider.slug)}>
                    {provider.slug === 'github' ? <img src="/orbis/home/github.svg" width={18} height={18} alt="" /> : <Building2 size={17} />}
                    <span>{provider.name}</span>
                  </Button>
                ))}
              </div>
            )}
            {canUsePassword && <div className="auth-divider">{t('Or sign in with username')}</div>}
          </>
        )}
        {!challenge && !canUsePassword && <p role="status">{t('Password login is disabled.')}</p>}
        {challenge && (
          <label className="field">
            <span>{t('Verification code')}</span>
            <input
              name="verification-code"
              value={code}
              autoComplete="one-time-code"
              autoFocus
              required
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
        )}
        {!challenge && canUsePassword && (
          <>
            <label className="field">
              <span>{t('Username')}</span>
              <div className="auth-input">
                <UserRound size={15} aria-hidden="true" />
                <input
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  autoFocus
                />
              </div>
            </label>
            <div className="field">
              <div className="auth-field-heading">
                <label htmlFor="login-password">{t('Password')}</label>
                <Link href="/forgot-password">{t('Forgot password?')}</Link>
              </div>
              <div className="password-field auth-input">
                <LockKeyhole size={15} aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button type="button" aria-label={t(show ? 'Hide password' : 'Show password')} onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </>
        )}
        {!challenge && status.data?.turnstile_check && <Turnstile key={captcha} siteKey={status.data.turnstile_site_key || ''} onToken={setToken} />}
        {domains.length > 1 && (
          <label className="field">
            <span>{t('Passkey domain')}</span>
            <select value={rpID} onChange={(event) => setRPID(event.target.value)}>
              <option value="">{t('Automatic')}</option>
              {domains.map((domain) => (
                <option key={domain}>{domain}</option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <div className="inline-error" role="alert">
            {t(error)}
          </div>
        )}
        <Button
          type="submit"
          disabled={
            busy ||
            !hydrated ||
            (!challenge && (!status.data || !canUsePassword || (!!status.data.turnstile_check && !token))) ||
            (!!challenge && !challenge.methods.some((method) => method.method === '2fa' && method.available))
          }
          className="auth-submit"
        >
          {submitLabel}
        </Button>
        {canUsePasskey && (
          <Button type="button" variant="outline" className="auth-submit auth-passkey" disabled={busy} onClick={passkey}>
            <KeyRound size={15} />
            {t('Use Passkey')}
          </Button>
        )}
        {challenge ? (
          <Button
            type="button"
            variant="ghost"
            className="auth-submit"
            disabled={busy}
            onClick={() => {
              setChallenge(null)
              setCode('')
            }}
          >
            {t('Back')}
          </Button>
        ) : (
          <p className="auth-switch">
            {t('No account yet?')}
            <Link href={returnTo && returnTo !== '/dashboard/overview' ? `/sign-up?redirect=${encodeURIComponent(returnTo)}` : '/sign-up'}>
              {t('Sign up')}
            </Link>
          </p>
        )}
      </form>
    </AuthShell>
  )
}
