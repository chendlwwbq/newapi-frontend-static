'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { dateTime } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { SecurityDialog } from './secure-verification/security-dialog'
import type { VerificationOperation } from './secure-verification/types'

interface AccessToken {
  id: number
  name: string
  token_ref: string
  token_hint: string
  scopes: string[]
  expires_at: number
  created_at: number
  last_used_at: number
  last_used_ip: string
}
interface Resource {
  resource: string
  label_key: string
  actions: { action: string; label_key: string; description_key: string }[]
}
interface Catalog {
  groups: { group: string; resources: Resource[] }[]
  max_tokens: number
  default_expiry_days: number
}
type Input = { name: string; scopes?: string[]; expires_at?: number }
type Action = { operation: VerificationOperation; method: string; path: string; body?: Input }

export function AccessTokens() {
  const { bundle } = useAuth()
  return bundle ? <AccessTokensContent key={`${bundle.user.id}:${bundle.session.sid}`} /> : null
}
function AccessTokensContent() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const list = useQuery({
    queryKey: ['access-tokens', bundle?.user.id],
    queryFn: ({ signal }) =>
      api<{ items: AccessToken[]; legacy: { token_hint: string; token_ref: string; retire_at: number } | null }>('/api/user/access_tokens', {
        signal,
      }),
  })
  const catalog = useQuery({
    queryKey: ['access-token-catalog', bundle?.user.id],
    queryFn: ({ signal }) => api<Catalog>('/api/user/access_tokens/catalog', { signal }),
  })
  const [editor, setEditor] = useState<AccessToken | 'new' | null>(null),
    [name, setName] = useState(''),
    [scopes, setScopes] = useState<string[]>([]),
    [expiry, setExpiry] = useState('30'),
    [custom, setCustom] = useState('')
  const [action, setAction] = useState<Action | null>(null),
    [created, setCreated] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const resources = catalog.data?.groups.flatMap((group) => group.resources) || []
  const grantable = new Set(resources.flatMap((resource) => resource.actions.map((item) => `${resource.resource}:${item.action}`)))
  const unavailable = scopes.filter((scope) => !grantable.has(scope))
  function open(token: AccessToken | 'new') {
    setEditor(token)
    setName(token === 'new' ? '' : token.name)
    setScopes(token === 'new' ? [] : token.scopes)
    setExpiry(String(catalog.data?.default_expiry_days || 30))
    setCustom('')
    setError('')
  }
  async function saved() {
    await queries.invalidateQueries({ queryKey: ['access-tokens'] })
    toast.success(t('Saved'))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const label = name.trim()
    if (!label || [...label].length > 64) {
      setError('Access token name must be 1 to 64 characters.')
      return
    }
    const changed = editor === 'new' || (editor && JSON.stringify([...scopes].sort()) !== JSON.stringify([...editor.scopes].sort()))
    if (changed && !scopes.length) {
      setError('Select at least one valid permission.')
      return
    }
    if (editor === 'new') {
      const expires_at =
        expiry === 'never'
          ? 0
          : expiry === 'custom'
            ? Math.floor(new Date(custom).getTime() / 1000)
            : Math.floor(Date.now() / 1000) + Number(expiry) * 86400
      if (expiry !== 'never' && (!Number.isFinite(expires_at) || expires_at < Date.now() / 1000 + 3600)) {
        setError('Access token expiry must be at least one hour from now.')
        return
      }
      const sorted = [...scopes].sort()
      setAction({
        operation: { scope: 'access_token.generate', context: { scopes: sorted, expires_at } },
        method: 'POST',
        path: '/api/user/access_tokens',
        body: { name: label, scopes: sorted, expires_at },
      })
    } else if (editor) {
      if (changed) {
        const sorted = [...scopes].sort()
        setAction({
          operation: { scope: 'access_token.update', context: { token_id: editor.id, scopes: sorted } },
          method: 'PATCH',
          path: `/api/user/access_tokens/${editor.id}`,
          body: { name: label, scopes: sorted },
        })
      } else {
        setBusy(true)
        try {
          await api(`/api/user/access_tokens/${editor.id}`, { method: 'PATCH', body: { name: label } })
          setEditor(null)
          await saved()
        } catch (failure) {
          setError((failure as Error).message)
        } finally {
          setBusy(false)
        }
      }
    }
  }
  async function authorized(proof: string, signal: AbortSignal) {
    if (!action) return
    const result = await api<{ token?: string }>(action.path, {
      method: action.method,
      body: action.body,
      signal,
      headers: { 'X-Security-Proof': proof },
    })
    signal.throwIfAborted()
    if (action.operation.scope === 'access_token.generate') setCreated(result.token || '')
    setEditor(null)
    await saved()
  }
  function revoke(token: AccessToken | 'legacy') {
    setAction({
      operation: { scope: 'access_token.revoke', context: token === 'legacy' ? { legacy: true } : { token_id: token.id } },
      method: 'DELETE',
      path: `/api/user/access_tokens/${token === 'legacy' ? 'legacy' : token.id}`,
    })
  }
  return (
    <section className="console-panel">
      <div className="security-section-heading">
        <h2>{t('Access Tokens')}</h2>
        <Button disabled={!catalog.data || !list.data || list.data.items.length >= catalog.data.max_tokens} onClick={() => open('new')}>
          {t('Create access token')}
        </Button>
      </div>
      <p className="small-note">{t('Panel access tokens call management APIs with selected permissions. Use API keys for model requests.')}</p>
      {catalog.error && <ErrorState error={catalog.error} retry={() => catalog.refetch()} />}
      {list.error ? (
        <ErrorState error={list.error} retry={() => list.refetch()} />
      ) : list.isPending ? (
        <LoadingState />
      ) : (
        <>
          {list.data.legacy && (
            <article className="admin-notice">
              <strong>{t('Legacy access token')}</strong>
              <p>
                <code>{list.data.legacy.token_hint}</code> · {t('Expiry')}: {dateTime(list.data.legacy.retire_at, toIntlLocale(i18n.language))}
              </p>
              <Button variant="destructive" onClick={() => revoke('legacy')}>
                {t('Revoke')}
              </Button>
            </article>
          )}
          {!list.data.items.length ? (
            <EmptyState />
          ) : (
            <div className="access-token-list">
              {list.data.items.map((token) => (
                <article key={token.id}>
                  <div className="console-page-heading">
                    <div>
                      <strong>{token.name}</strong>
                      <p className="small-note">
                        <code>{token.token_hint}</code> · {t('Expiry')}:{' '}
                        {token.expires_at ? dateTime(token.expires_at, toIntlLocale(i18n.language)) : t('Never expires')}
                        {!!token.expires_at && token.expires_at <= Date.now() / 1000 && ` · ${t('Expired')}`}
                      </p>
                    </div>
                    <div className="action-buttons">
                      <Button variant="outline" onClick={() => open(token)}>
                        {t('Edit')}
                      </Button>
                      <Button variant="outline" onClick={() => revoke(token)}>
                        {t('Revoke')}
                      </Button>
                    </div>
                  </div>
                  <details>
                    <summary>
                      {t('Permissions')} ({token.scopes.length})
                    </summary>
                    <ul>
                      {token.scopes.map((scope) => (
                        <li key={scope}>
                          <code>{scope}</code>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <p className="small-note">
                    {t('Last used')}: {token.last_used_at ? dateTime(token.last_used_at, toIntlLocale(i18n.language)) : '—'} {token.last_used_ip}
                  </p>
                </article>
              ))}
            </div>
          )}
          <p className="small-note">
            {list.data.items.length} / {catalog.data?.max_tokens ?? '—'}
          </p>
        </>
      )}
      <Dialog
        open={!!editor && !action}
        onOpenChange={(open) => {
          if (!open && !busy) setEditor(null)
        }}
      >
        <DialogContent className="admin-editor flex max-h-[88vh] flex-col overflow-hidden" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t(editor === 'new' ? 'Create access token' : 'Edit access token')}</DialogTitle>
            <DialogDescription>{t('Select only the permissions this application needs.')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto pr-1">
            <fieldset className="admin-pricing-fields" disabled={busy}>
              <label className="field">
                <span>{t('Name')}</span>
                <input required value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              {editor === 'new' && (
                <>
                  <label className="field">
                    <span>{t('Expiry')}</span>
                    <select value={expiry} onChange={(event) => setExpiry(event.target.value)}>
                      {[30, 90, 180, 365].map((days) => (
                        <option key={days} value={days}>
                          {days} {t('Days')}
                        </option>
                      ))}
                      <option value="custom">{t('Custom')}</option>
                      <option value="never">{t('Never expires')}</option>
                    </select>
                  </label>
                  {expiry === 'custom' && (
                    <label className="field">
                      <span>{t('Expiry')}</span>
                      <input type="datetime-local" value={custom} required onChange={(event) => setCustom(event.target.value)} />
                    </label>
                  )}
                </>
              )}
              {catalog.isPending ? (
                <LoadingState />
              ) : (
                catalog.data?.groups.map((group) => (
                  <fieldset className="admin-permissions" key={group.group}>
                    <legend>{t({ personal: 'Personal', admin: 'Administration', system: 'System' }[group.group] || group.group)}</legend>
                    {group.resources.map((resource) => (
                      <div key={resource.resource}>
                        <strong className="small-note">{t(resource.label_key)}</strong>
                        {resource.actions.map((item) => {
                          const scope = `${resource.resource}:${item.action}`
                          return (
                            <label key={scope} className="checkbox-label" title={t(item.description_key)}>
                              <input
                                type="checkbox"
                                checked={scopes.includes(scope)}
                                onChange={(event) =>
                                  setScopes((current) => (event.target.checked ? [...current, scope] : current.filter((value) => value !== scope)))
                                }
                              />
                              {t(item.label_key)}
                            </label>
                          )
                        })}
                      </div>
                    ))}
                  </fieldset>
                ))
              )}
              {!!unavailable.length && (
                <fieldset className="admin-permissions">
                  <legend>{t('Unavailable')}</legend>
                  {unavailable.map((scope) => (
                    <label className="checkbox-label" key={scope}>
                      <input type="checkbox" checked onChange={() => setScopes((current) => current.filter((value) => value !== scope))} />
                      <code>{scope}</code>
                    </label>
                  ))}
                </fieldset>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {t(error)}
                </p>
              )}
              <Button type="submit" loading={busy} disabled={!catalog.data}>
                {t('Save')}
              </Button>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
      {action && (
        <SecurityDialog
          operation={action.operation}
          title={action.method === 'DELETE' ? 'Revoke access token' : 'Verify and continue'}
          onAuthorized={authorized}
          onClose={() => setAction(null)}
        />
      )}
      <Dialog
        open={!!created}
        onOpenChange={(open) => {
          if (!open) setCreated('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Access token created')}</DialogTitle>
            <DialogDescription>{t('Copy this token now. It will not be shown again.')}</DialogDescription>
          </DialogHeader>
          <div className="recovery-secret">
            <code className="admin-secret">{created}</code>
            <CopyButton value={created} />
          </div>
          <Button onClick={() => setCreated('')}>{t('Close')}</Button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
