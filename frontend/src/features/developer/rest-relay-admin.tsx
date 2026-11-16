'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AdminConfirm } from '@/features/admin/shared'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import type { RestUpstream, RestUpstreamList, RestRelayConfig, RestCredentialSummary } from './types'

type InjectionRow = { id: number; location: 'headers' | 'query' | 'cookies' | 'body'; key: string; value: string }
type CredentialsDraft = {
  injectionMode: 'keep' | 'replace'
  rows: InjectionRow[]
  authMode: 'keep' | 'none' | 'headers'
  header: string
  secret: string
}
const emptyCredentials: CredentialsDraft = { injectionMode: 'keep', rows: [], authMode: 'keep', header: 'Authorization', secret: '' }
const emptyUpstream: RestUpstream = { id: 0, slug: '', name: '', description: '', icon: '', base_url: '', status: 1 }

function credentialPayload(draft: CredentialsDraft) {
  const result: {
    injection_config?: Record<string, Record<string, unknown>>
    upstream_auth_config?: { type: string; headers?: Record<string, string> }
  } = {}
  if (draft.injectionMode === 'replace') {
    const injection: Record<string, Record<string, unknown>> = { headers: {}, query: {}, cookies: {}, body: {} }
    for (const row of draft.rows) {
      if (!row.key.trim()) throw new Error('Injection field names are required')
      if (
        Object.keys(injection[row.location]).some((key) =>
          row.location === 'headers' ? key.toLowerCase() === row.key.trim().toLowerCase() : key === row.key.trim()
        )
      )
        throw new Error('Duplicate injection field')
      injection[row.location][row.key.trim()] = row.value
    }
    result.injection_config = injection
  }
  if (draft.authMode === 'none') result.upstream_auth_config = { type: 'none' }
  if (draft.authMode === 'headers') {
    if (!draft.header.trim() || !draft.secret) throw new Error('Authentication header and value are required')
    result.upstream_auth_config = { type: 'headers', headers: { [draft.header.trim()]: draft.secret } }
  }
  return result
}

function CredentialFields(props: { value: CredentialsDraft; onChange: (value: CredentialsDraft) => void; summary?: RestCredentialSummary }) {
  const { t } = useTranslation(),
    draft = props.value
  return (
    <>
      <label className="field">
        <span>{t('Upstream authentication')}</span>
        <select
          value={draft.authMode}
          onChange={(event) => props.onChange({ ...draft, authMode: event.target.value as CredentialsDraft['authMode'], secret: '' })}
        >
          <option value="keep">{t('Keep configured credentials')}</option>
          <option value="none">{t('No authentication')}</option>
          <option value="headers">{t('Replace authentication header')}</option>
        </select>
      </label>
      {props.summary && (
        <p className="small-note">
          {t('Configured authentication headers')}: {props.summary.auth_header_names?.join(', ') || '—'}
        </p>
      )}
      {draft.authMode === 'headers' && (
        <div className="admin-form-grid">
          <label className="field">
            <span>{t('Header name')}</span>
            <Input required value={draft.header} onChange={(event) => props.onChange({ ...draft, header: event.target.value })} />
          </label>
          <label className="field">
            <span>{t('Header value')}</span>
            <Input
              required
              type="password"
              autoComplete="new-password"
              value={draft.secret}
              onChange={(event) => props.onChange({ ...draft, secret: event.target.value })}
            />
          </label>
        </div>
      )}
      <label className="field">
        <span>{t('Request injection')}</span>
        <select
          value={draft.injectionMode}
          onChange={(event) => props.onChange({ ...draft, injectionMode: event.target.value as CredentialsDraft['injectionMode'], rows: [] })}
        >
          <option value="keep">{t('Keep configured injection')}</option>
          <option value="replace">{t('Replace injection configuration')}</option>
        </select>
      </label>
      {props.summary && (
        <p className="small-note">
          {Object.entries(props.summary.injection_keys || {})
            .filter(([, keys]) => keys.length)
            .map(([location, keys]) => `${location}: ${keys.join(', ')}`)
            .join(' · ') || t('No request injection')}
        </p>
      )}
      {draft.injectionMode === 'replace' && (
        <div className="rest-injection-editor">
          <p className="small-note">
            {t('Replacement overwrites this level. Empty rows clear its injection. API fields override inherited upstream fields.')}
          </p>
          {draft.rows.map((row) => (
            <div className="rest-injection-row" key={row.id}>
              <select
                aria-label={t('Injection location')}
                value={row.location}
                onChange={(event) =>
                  props.onChange({
                    ...draft,
                    rows: draft.rows.map((item) =>
                      item.id === row.id ? { ...item, location: event.target.value as InjectionRow['location'] } : item
                    ),
                  })
                }
              >
                {(['headers', 'query', 'cookies', 'body'] as const).map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              <Input
                aria-label={t('Field name')}
                placeholder={t('Field name')}
                required
                value={row.key}
                onChange={(event) =>
                  props.onChange({ ...draft, rows: draft.rows.map((item) => (item.id === row.id ? { ...item, key: event.target.value } : item)) })
                }
              />
              <Input
                aria-label={t('Field value')}
                placeholder={t('Field value')}
                type="password"
                autoComplete="new-password"
                value={row.value}
                onChange={(event) =>
                  props.onChange({ ...draft, rows: draft.rows.map((item) => (item.id === row.id ? { ...item, value: event.target.value } : item)) })
                }
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => props.onChange({ ...draft, rows: draft.rows.filter((item) => item.id !== row.id) })}
              >
                {t('Remove')}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              props.onChange({
                ...draft,
                rows: [...draft.rows, { id: Math.max(0, ...draft.rows.map((row) => row.id)) + 1, location: 'headers', key: '', value: '' }],
              })
            }
          >
            {t('Add injection field')}
          </Button>
        </div>
      )}
      <p className="small-note">{t('Credential values are write-only. Body fields are injected as strings into a JSON object.')}</p>
    </>
  )
}

function useRelayMutation(onSaved: () => void) {
  const queries = useQueryClient(),
    { t } = useTranslation()
  return useMutation({
    mutationFn: (input: { path: string; method: string; body?: unknown; version: number }) =>
      api(input.path, { method: input.method, body: input.body, headers: { 'If-Match': String(input.version) } }),
    onSuccess: async () => {
      await Promise.all([
        queries.invalidateQueries({ queryKey: ['rest-admin'] }),
        queries.invalidateQueries({ queryKey: ['rest-published'] }),
        queries.invalidateQueries({ queryKey: ['developer-admin'] }),
      ])
      onSaved()
      toast.success(t('Saved'))
    },
    onError: (error: Error) => toast.error(t(error.message)),
  })
}

export function RestUpstreamsAdmin() {
  const { t } = useTranslation(),
    [open, setOpen] = useState(false),
    [editor, setEditor] = useState<RestUpstream | null>(null),
    [credentials, setCredentials] = useState<CredentialsDraft>(emptyCredentials),
    [deleting, setDeleting] = useState<RestUpstream | null>(null),
    [formError, setFormError] = useState('')
  const query = useQuery({
    queryKey: ['rest-admin', 'upstreams'],
    enabled: open,
    queryFn: ({ signal }) => api<RestUpstreamList>('/api/rest-api/admin/upstreams', { signal }),
  })
  const mutation = useRelayMutation(() => {
    setEditor(null)
    setDeleting(null)
    setCredentials(emptyCredentials)
    setFormError('')
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!editor) return
    try {
      mutation.mutate({
        path: `/api/rest-api/admin/upstreams${editor.id ? `/${editor.id}` : ''}`,
        method: editor.id ? 'PUT' : 'POST',
        version: query.data?.version ?? 0,
        body: { ...editor, ...credentialPayload(credentials) },
      })
    } catch (error) {
      setFormError((error as Error).message)
    }
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t('REST upstreams')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) {
            setOpen(value)
            if (!value) {
              setEditor(null)
              setCredentials(emptyCredentials)
            }
          }
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('REST upstreams')}</DialogTitle>
            <DialogDescription>{t('Reusable upstream addresses and write-only credentials.')}</DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              setEditor({ ...emptyUpstream })
              setCredentials(emptyCredentials)
              setFormError('')
            }}
          >
            {t('Add upstream')}
          </Button>
          {query.error ? (
            <ErrorState error={query.error} retry={() => query.refetch()} />
          ) : query.isPending ? (
            <LoadingState />
          ) : !query.data.items.length ? (
            <EmptyState />
          ) : (
            <div className="developer-operations-list">
              {query.data.items.map(({ upstream }) => (
                <section className="developer-operation" key={upstream.id}>
                  <h3>{upstream.name}</h3>
                  <p className="small-note">
                    {upstream.base_url} · {t(upstream.status === 1 ? 'Enabled' : 'Disabled')}
                  </p>
                  <div className="action-buttons">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditor({ ...upstream })
                        setCredentials(emptyCredentials)
                        setFormError('')
                      }}
                    >
                      {t('Edit')}
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleting(upstream)}>
                      {t('Delete')}
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editor}
        onOpenChange={(value) => {
          if (!value && !mutation.isPending) {
            setEditor(null)
            setCredentials(emptyCredentials)
          }
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t(editor?.id ? 'Edit upstream' : 'Add upstream')}</DialogTitle>
            <DialogDescription>{t('Reusable upstream addresses and write-only credentials.')}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form onSubmit={submit}>
              <div className="admin-form-grid">
                <label className="field">
                  <span>{t('Slug')}</span>
                  <Input
                    required
                    pattern="[a-z0-9][a-z0-9-]{0,95}"
                    value={editor.slug}
                    onChange={(event) => setEditor({ ...editor, slug: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>{t('Name')}</span>
                  <Input required maxLength={160} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} />
                </label>
              </div>
              <label className="field">
                <span>{t('Upstream base URL')}</span>
                <Input required type="url" value={editor.base_url} onChange={(event) => setEditor({ ...editor, base_url: event.target.value })} />
              </label>
              <CredentialFields
                value={credentials}
                onChange={setCredentials}
                summary={query.data?.items.find((item) => item.upstream.id === editor.id)}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editor.status === 1}
                  onChange={(event) => setEditor({ ...editor, status: event.target.checked ? 1 : 2 })}
                />
                {t('Enabled')}
              </label>
              {(formError || mutation.error) && (
                <p role="alert" className="inline-error">
                  {t(formError || mutation.error?.message || '')}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditor(null)
                    setCredentials(emptyCredentials)
                  }}
                  disabled={mutation.isPending}
                >
                  {t('Cancel')}
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {t('Save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {deleting && (
        <AdminConfirm
          title={t('Delete upstream')}
          description={deleting.name}
          busy={mutation.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            mutation.mutate({ path: `/api/rest-api/admin/upstreams/${deleting.id}`, method: 'DELETE', version: query.data?.version ?? 0 })
          }
        />
      )}
    </>
  )
}

export function RestRelayButton(props: { apiID: number; name: string }) {
  const { t } = useTranslation(),
    [open, setOpen] = useState(false)
  const config = useQuery({
    queryKey: ['rest-admin', 'relay', props.apiID],
    enabled: open,
    queryFn: ({ signal }) => api<RestRelayConfig>(`/api/rest-api/admin/${props.apiID}/relay`, { signal }),
  })
  const upstreams = useQuery({
    queryKey: ['rest-admin', 'upstreams'],
    enabled: open,
    queryFn: ({ signal }) => api<RestUpstreamList>('/api/rest-api/admin/upstreams', { signal }),
  })
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t('Relay configuration')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>
              {t('Relay configuration')} · {props.name}
            </DialogTitle>
            <DialogDescription>{t('API fields override inherited upstream fields. Leave the base URL empty to inherit it.')}</DialogDescription>
          </DialogHeader>
          {config.error || upstreams.error ? (
            <ErrorState
              error={(config.error || upstreams.error)!}
              retry={() => {
                void config.refetch()
                void upstreams.refetch()
              }}
            />
          ) : config.isPending || upstreams.isPending ? (
            <LoadingState />
          ) : (
            <RelayConfigForm
              key={`${props.apiID}-${config.data.version}`}
              apiID={props.apiID}
              config={config.data}
              upstreams={upstreams.data}
              onSaved={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function RelayConfigForm(props: { apiID: number; config: RestRelayConfig; upstreams: RestUpstreamList; onSaved: () => void }) {
  const { t } = useTranslation(),
    [baseURL, setBaseURL] = useState(props.config.base_url),
    [upstreamID, setUpstreamID] = useState(props.config.upstream_id),
    [credentials, setCredentials] = useState<CredentialsDraft>(emptyCredentials),
    [formError, setFormError] = useState('')
  const mutation = useRelayMutation(props.onSaved)
  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      mutation.mutate({
        path: `/api/rest-api/admin/${props.apiID}/relay`,
        method: 'PUT',
        version: props.config.version,
        body: { base_url: baseURL, upstream_id: upstreamID, ...credentialPayload(credentials) },
      })
    } catch (error) {
      setFormError((error as Error).message)
    }
  }
  const inherited = props.upstreams.items.find((item) => item.upstream.id === upstreamID)
  return (
    <form onSubmit={submit}>
      <label className="field">
        <span>{t('REST upstream')}</span>
        <select value={upstreamID} onChange={(event) => setUpstreamID(Number(event.target.value))}>
          <option value="0">{t('Standalone upstream URL')}</option>
          {props.upstreams.items.map(({ upstream }) => (
            <option key={upstream.id} value={upstream.id}>
              {upstream.name} · {t(upstream.status === 1 ? 'Enabled' : 'Disabled')}
            </option>
          ))}
        </select>
      </label>
      {inherited && (
        <p className="small-note">
          {t('Inherited upstream')}: {inherited.upstream.base_url}
          <br />
          {Object.entries(inherited.injection_keys || {})
            .filter(([, keys]) => keys.length)
            .map(([location, keys]) => `${location}: ${keys.join(', ')}`)
            .join(' · ')}
        </p>
      )}
      <label className="field">
        <span>{t('Upstream base URL')}</span>
        <Input type="url" required={!upstreamID} value={baseURL} onChange={(event) => setBaseURL(event.target.value)} />
      </label>
      <CredentialFields value={credentials} onChange={setCredentials} summary={props.config} />
      {(formError || mutation.error) && (
        <p className="inline-error" role="alert">
          {t(formError || mutation.error?.message || '')}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={props.onSaved}>
          {t('Cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {t('Save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
