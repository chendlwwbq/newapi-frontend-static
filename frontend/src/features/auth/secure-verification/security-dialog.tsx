'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { verifySecurityOperation } from './verify'
import Link from 'next/link'
import type { VerificationMethod, VerificationInput, VerificationOperation, VerificationRequirements } from './types'

export function SecurityDialog({
  operation,
  title,
  onAuthorized,
  onClose,
}: {
  operation: VerificationOperation
  title: string
  onAuthorized: (proof: string, signal: AbortSignal) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<VerificationMethod | ''>(''),
    [password, setPassword] = useState(''),
    [code, setCode] = useState(''),
    [provider, setProvider] = useState('')
  const [rpID, setRPID] = useState(''),
    [domains, setDomains] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const request = useRef<AbortController | null>(null),
    executing = useRef(false)
  useEffect(() => () => request.current?.abort(), [])
  const requirements = useQuery({
    queryKey: ['security-methods', operation.scope],
    queryFn: ({ signal }) => api<VerificationRequirements>(`/api/verify/methods?scope=${encodeURIComponent(operation.scope)}`, { signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const methods =
    requirements.data?.methods.filter(
      (option) => option.available && (option.method !== 'passkey' || (typeof window !== 'undefined' && !!window.PublicKeyCredential))
    ) || []
  const selected = methods.some((option) => option.method === method) ? method : methods[0]?.method
  const oauthProvider = provider || requirements.data?.oauth_providers[0]?.slug || ''
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected || !requirements.data) return
    setBusy(true)
    setError('')
    request.current = new AbortController()
    const signal = request.current.signal
    try {
      const input: VerificationInput =
        selected === 'password'
          ? { method: selected, password }
          : selected === '2fa'
            ? { method: selected, code }
            : selected === 'oauth'
              ? { method: selected, provider: oauthProvider }
              : selected === 'passkey'
                ? { method: selected, rpID: rpID || undefined }
                : { method: 'session' }
      const proof = await verifySecurityOperation(input, operation, requirements.data.password_encryption_enabled, signal, (info) =>
        setDomains(info.rpIDs)
      )
      signal.throwIfAborted()
      setPassword('')
      setCode('')
      executing.current = true
      await onAuthorized(proof.proof_token, signal)
      onClose()
    } catch (err) {
      if (!signal.aborted) setError((err as Error).message)
    } finally {
      executing.current = false
      if (!signal.aborted) setBusy(false)
    }
  }
  function close() {
    if (executing.current) return
    request.current?.abort()
    onClose()
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className="security-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{t(title)}</DialogTitle>
          <DialogDescription>{t('Verify your identity to continue. This approval applies only to this action.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          {requirements.isPending && <p>{t('Loading')}</p>}
          {requirements.error && (
            <p className="inline-error" role="alert">
              {t(requirements.error.message)}
            </p>
          )}
          {!!methods.length && (
            <label className="field">
              <span>{t('Verification method')}</span>
              <select
                disabled={busy}
                value={selected}
                onChange={(event) => {
                  setMethod(event.target.value as VerificationMethod)
                  setPassword('')
                  setCode('')
                }}
              >
                {methods.map((option) => (
                  <option key={option.method} value={option.method}>
                    {t(
                      option.method === '2fa'
                        ? 'Authenticator or backup code'
                        : option.method === 'password'
                          ? 'Password'
                          : option.method === 'passkey'
                            ? 'Passkey'
                            : option.method === 'oauth'
                              ? 'Linked OAuth account'
                              : 'Current session'
                    )}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected === 'password' && (
            <label className="field">
              <span>{t('Password')}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={busy}
              />
            </label>
          )}
          {selected === '2fa' && (
            <label className="field">
              <span>{t('Authenticator or backup code')}</span>
              <input autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required disabled={busy} />
            </label>
          )}
          {selected === 'oauth' && (
            <label className="field">
              <span>{t('Linked OAuth account')}</span>
              <select disabled={busy} value={oauthProvider} onChange={(event) => setProvider(event.target.value)}>
                {requirements.data?.oauth_providers.map((item) => (
                  <option value={item.slug} key={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected === 'passkey' && domains.length > 1 && (
            <label className="field">
              <span>{t('Passkey domain')}</span>
              <select disabled={busy} value={rpID} onChange={(event) => setRPID(event.target.value)}>
                <option value="">{t('Automatic')}</option>
                {domains.map((domain) => (
                  <option key={domain}>{domain}</option>
                ))}
              </select>
            </label>
          )}
          {requirements.data && !methods.length && (
            <>
              <p className="inline-error">{t('No verification method is available for this action.')}</p>
              {operation.scope === 'channel.key.read' && (
                <Link className="text-link" href="/security" onClick={close}>
                  {t('Security')} ↗
                </Link>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {t(error)}
            </p>
          )}
          <div className="security-actions">
            <Button type="button" variant="outline" onClick={close} disabled={executing.current}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={busy || !selected || (selected === 'oauth' && !oauthProvider)}>
              {t(busy ? 'Loading' : 'Verify and continue')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
