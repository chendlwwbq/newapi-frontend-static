'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { AuthShell } from './auth-shell'

interface SetupStatus {
  status: boolean
  root_init: boolean
  database_type: string
}
const steps = ['Database check', 'Administrator account', 'Usage mode', 'Review & initialize']
const modes = [
  ['external', 'External operations', 'Serve multiple users or teams with billing and quota control.'],
  ['self', 'Personal use', 'Best for single-tenant deployments. Pricing and billing options stay hidden.'],
  ['demo', 'Demo site', 'Showcase core capabilities with demo credentials and limited access.'],
]
export function SetupPage() {
  const { t } = useTranslation(),
    queries = useQueryClient()
  const status = useQuery({
    queryKey: ['setup-status'],
    queryFn: ({ signal }) => api<SetupStatus>('/api/setup', { anonymous: true, signal }),
    staleTime: 0,
  })
  const [step, setStep] = useState(0),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [mode, setMode] = useState('external')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!status.data || status.data.status) return
    if (step === 1 && !status.data.root_init) {
      if (!username.trim() || new TextEncoder().encode(username.trim()).length > 12) {
        setError('Username must be 12 bytes or fewer.')
        return
      }
      if ([...password].length < 8 || [...password].length > 128) {
        setError('Password must contain between 8 and 128 characters.')
        return
      }
      if (password !== confirm) {
        setError('Passwords do not match')
        return
      }
    }
    if (step < 3) {
      setStep(step + 1)
      return
    }
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    try {
      await api('/api/setup', {
        method: 'POST',
        anonymous: true,
        signal: controller.signal,
        body: {
          SelfUseModeEnabled: mode === 'self',
          DemoSiteEnabled: mode === 'demo',
          ...(!status.data.root_init ? { username: username.trim(), password, confirmPassword: confirm } : {}),
        },
      })
      controller.signal.throwIfAborted()
      setPassword('')
      setConfirm('')
      setDone(true)
      await Promise.all([queries.invalidateQueries({ queryKey: ['status'] }), queries.invalidateQueries({ queryKey: ['setup-status'] })])
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError((failure as Error).message)
        void status.refetch()
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }
  if (status.error)
    return (
      <AuthShell>
        <ErrorState error={status.error} retry={() => status.refetch()} />
      </AuthShell>
    )
  if (!status.data)
    return (
      <AuthShell>
        <LoadingState />
      </AuthShell>
    )
  if (done || status.data.status)
    return (
      <AuthShell>
        <h1>{t(done ? 'System initialized successfully' : 'The system is already initialized')}</h1>
        <p>{t('Sign in with the administrator account to continue.')}</p>
        <Link className="pill-button" href="/sign-in">
          {t('Sign in')} →
        </Link>
      </AuthShell>
    )
  return (
    <AuthShell>
      <span className="eyebrow">
        {t('System setup')} · {step + 1}/4
      </span>
      <h1>{t(steps[step])}</h1>
      <ol className="setup-steps">
        {steps.map((label, index) => (
          <li key={label} aria-current={step === index ? 'step' : undefined}>
            {index + 1}. {t(label)}
          </li>
        ))}
      </ol>
      <form onSubmit={submit}>
        <fieldset className="admin-pricing-fields" disabled={busy}>
          {step === 0 && (
            <>
              <p>{t('Verify your database connection')}</p>
              <dl className="ops-details">
                <div>
                  <dt>{t('Database type')}</dt>
                  <dd>{status.data.database_type}</dd>
                </div>
                <div>
                  <dt>{t('Administrator account')}</dt>
                  <dd>{t(status.data.root_init ? 'Already exists' : 'Not created')}</dd>
                </div>
              </dl>
            </>
          )}
          {step === 1 &&
            (status.data.root_init ? (
              <p className="admin-notice">{t('The administrator account already exists. Its credentials will be preserved.')}</p>
            ) : (
              <>
                <label className="field">
                  <span>{t('Username')}</span>
                  <input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
                </label>
                <label className="field">
                  <span>{t('Password')}</span>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>{t('Confirm password')}</span>
                  <Input type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
                </label>
                <p className="small-note">{t('Password must contain between 8 and 128 characters.')}</p>
              </>
            ))}
          {step === 2 && (
            <div className="setup-modes">
              {modes.map(([value, label, description]) => (
                <label key={value}>
                  <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                  <span>
                    <strong>{t(label)}</strong>
                    <small>{t(description)}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          {step === 3 && (
            <>
              <p>{t('Confirm settings and finish setup')}</p>
              <dl className="ops-details">
                <div>
                  <dt>{t('Database type')}</dt>
                  <dd>{status.data.database_type}</dd>
                </div>
                <div>
                  <dt>{t('Administrator account')}</dt>
                  <dd>{status.data.root_init ? t('Already exists') : username.trim()}</dd>
                </div>
                <div>
                  <dt>{t('Usage mode')}</dt>
                  <dd>{t(modes.find((item) => item[0] === mode)![1])}</dd>
                </div>
              </dl>
            </>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="security-actions">
            {step > 0 && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setError('')
                  setStep(step - 1)
                }}
              >
                {t('Back')}
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {t(busy ? 'Loading' : step === 3 ? 'Initialize system' : 'Continue')}
            </Button>
          </div>
        </fieldset>
      </form>
    </AuthShell>
  )
}
