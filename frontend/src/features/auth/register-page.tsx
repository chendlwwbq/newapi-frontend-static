'use client'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import { AuthShell } from './auth-shell'
import { Turnstile } from './turnstile'
import { useAuthStatus } from './use-auth-status'

export function RegisterPage({ affiliate = '', returnTo }: { affiliate?: string; returnTo?: string }) {
  const { t } = useTranslation(),
    status = useAuthStatus()
  const signInHref = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? `/sign-in?redirect=${encodeURIComponent(returnTo)}` : '/sign-in'
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [accepted, setAccepted] = useState(false)
  const [token, setToken] = useState(''),
    [captcha, setCaptcha] = useState(0),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('')
  const config = status.data,
    legal = config?.user_agreement_enabled || config?.privacy_policy_enabled
  const enabled = config?.register_enabled && config?.password_register_enabled
  const ready = enabled && (!config?.turnstile_check || !!token)
  async function sendCode() {
    setBusy(true)
    setError('')
    try {
      await api(`/api/verification?${new URLSearchParams({ email, turnstile: token })}`, { anonymous: true })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setToken('')
      setCaptcha((value) => value + 1)
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await api(`/api/user/register?${new URLSearchParams({ turnstile: token })}`, {
        anonymous: true,
        method: 'POST',
        body: { username, password, ...(config?.email_verification ? { email, verification_code: code } : {}), aff_code: affiliate },
      })
      setPassword('')
      setConfirm('')
      setCode('')
      setDone(true)
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
      <h1>{t(done ? 'Account created' : 'Create account')}</h1>
      <p>{t('One key. Endless possibilities.')}</p>
      {done ? (
        <>
          <p role="status">{t('Your account is ready. Sign in to continue.')}</p>
          <Link href={signInHref} className="pill-button">
            {t('Sign in')}
          </Link>
        </>
      ) : (
        <form onSubmit={submit}>
          {status.isPending ? <p>{t('Loading')}</p> : !enabled && <p role="status">{t('Password registration is disabled.')}</p>}
          {status.isError && (
            <p role="alert" className="inline-error">
              {t(status.error.message)}
            </p>
          )}
          {enabled && (
            <>
              <label className="field">
                <span>{t('Username')}</span>
                <input
                  autoComplete="username"
                  minLength={1}
                  maxLength={20}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>{t('Password')}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>{t('Confirm password')}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              </label>
              {config?.email_verification && (
                <>
                  <label className="field">
                    <span>{t('Email')}</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        setSent(false)
                      }}
                      required
                    />
                  </label>
                  <div className="verification-code-row">
                    <label className="field">
                      <span>{t('Verification code')}</span>
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        required
                      />
                    </label>
                    <Button type="button" variant="outline" onClick={sendCode} disabled={busy || !ready || !email}>
                      {t(sent ? 'Resend code' : 'Send code')}
                    </Button>
                  </div>
                  {sent && (
                    <p role="status" className="small-note">
                      {t('Check your email for the verification code.')}
                    </p>
                  )}
                </>
              )}
              {legal && (
                <label className="auth-legal">
                  <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
                  <span>
                    {t('I agree to the following policies:')}{' '}
                    {config?.user_agreement_enabled && (
                      <Link href="/user-agreement" target="_blank">
                        {t('Terms of service')}
                      </Link>
                    )}{' '}
                    {config?.privacy_policy_enabled && (
                      <Link href="/privacy-policy" target="_blank">
                        {t('Privacy policy')}
                      </Link>
                    )}
                  </span>
                </label>
              )}
              {config?.turnstile_check && <Turnstile key={captcha} siteKey={config.turnstile_site_key || ''} onToken={setToken} />}
              {error && (
                <p role="alert" className="inline-error">
                  {t(error)}
                </p>
              )}
              <Button type="submit" className="auth-submit" disabled={busy || !ready || (!!legal && !accepted)}>
                {t(busy ? 'Loading' : 'Sign up')}
              </Button>
            </>
          )}
          <p className="auth-switch">
            {t('Already have an account?')} <Link href={signInHref}>{t('Sign in')}</Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
