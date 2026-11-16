'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ErrorState, LoadingState, EmptyState } from '@/components/shared/states'
import { AdminConfirm } from './shared'
import { Input } from '@/components/ui/input'
import { AccessPolicyEditor } from './access-policy-editor'
import { OAuthCallbacks } from './oauth-callbacks'

interface Provider {
  id: number
  name: string
  slug: string
  icon: string
  enabled: boolean
  client_id: string
  authorization_endpoint: string
  token_endpoint: string
  user_info_endpoint: string
  scopes: string
  user_id_field: string
  username_field: string
  display_name_field: string
  email_field: string
  well_known: string
  auth_style: number
  access_policy: string
  access_denied_message: string
}
const empty: Omit<Provider, 'id'> = {
  name: '',
  slug: '',
  icon: '',
  enabled: false,
  client_id: '',
  authorization_endpoint: '',
  token_endpoint: '',
  user_info_endpoint: '',
  scopes: 'openid profile email',
  user_id_field: 'sub',
  username_field: 'preferred_username',
  display_name_field: 'name',
  email_field: 'email',
  well_known: '',
  auth_style: 0,
  access_policy: '',
  access_denied_message: '',
}
const fields = [
  ['name', 'Name', true],
  ['slug', 'Slug', true],
  ['icon', 'Icon', false],
  ['client_id', 'Client ID', true],
  ['authorization_endpoint', 'Authorization Endpoint', true],
  ['token_endpoint', 'Token Endpoint', true],
  ['user_info_endpoint', 'User Info Endpoint', true],
  ['scopes', 'Scopes', true],
  ['user_id_field', 'User ID Field', true],
  ['username_field', 'Username Field', true],
  ['display_name_field', 'Display Name Field', true],
  ['email_field', 'Email Field', true],
  ['access_denied_message', 'Access Denied Message', false],
] as const

function ProviderForm({
  provider,
  serverAddress,
  onClose,
  onSaved,
}: {
  provider: Provider | null
  serverAddress: string
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation(),
    [draft, setDraft] = useState(provider || empty),
    [secret, setSecret] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      if (draft.access_policy.trim()) JSON.parse(draft.access_policy)
      setBusy(true)
      // Native update preserves a blank secret. Never read it into cache/state.
      const { id: _id, ...values } = { ...draft, id: provider?.id }
      await api(`/api/custom-oauth-provider${provider ? `/${provider.id}` : ''}`, {
        method: provider ? 'PUT' : 'POST',
        body: { ...values, ...(secret ? { client_secret: secret } : {}) },
      })
      setSecret('')
      toast.success(t('Saved'))
      onSaved()
      onClose()
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function discover() {
    setBusy(true)
    setError('')
    try {
      const result = await api<{
        well_known_url: string
        discovery: { authorization_endpoint?: string; token_endpoint?: string; userinfo_endpoint?: string; scopes_supported?: string[] }
      }>('/api/custom-oauth-provider/discovery', { method: 'POST', body: { well_known_url: draft.well_known } })
      setDraft((previous) => ({
        ...previous,
        well_known: result.well_known_url,
        authorization_endpoint: result.discovery.authorization_endpoint || previous.authorization_endpoint,
        token_endpoint: result.discovery.token_endpoint || previous.token_endpoint,
        user_info_endpoint: result.discovery.userinfo_endpoint || previous.user_info_endpoint,
      }))
      toast.success(t('Discovery configuration loaded. Review the endpoints before saving.'))
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="custom-oauth-dialog">
        <DialogHeader>
          <DialogTitle>{t(provider ? 'Edit OAuth Provider' : 'Add OAuth Provider')}</DialogTitle>
          <DialogDescription>{t('Configure the identity provider, user fields and access policy.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} autoComplete="off">
          <fieldset disabled={busy} className="admin-pricing-fields settings-fields">
            <label className="field">
              {t('Well-Known URL')}
              <Input type="url" value={draft.well_known} onChange={(event) => setDraft({ ...draft, well_known: event.target.value })} />
            </label>
            <Button type="button" variant="outline" disabled={!draft.well_known} onClick={discover}>
              {t('Discover endpoints')}
            </Button>
            {fields.map(([key, label, required]) => (
              <label className="field" key={key}>
                {t(label)}
                <Input
                  required={required}
                  pattern={key === 'slug' ? '[a-z0-9-]+' : undefined}
                  type={key.endsWith('_endpoint') ? 'url' : 'text'}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              </label>
            ))}
            <label className="field">
              {t('Client Secret')}
              <Input
                type="password"
                autoComplete="new-password"
                required={!provider}
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
              {provider && <small className="small-note">{t('Leave blank to keep the stored value.')}</small>}
            </label>
            <label className="field">
              {t('Authentication Style')}
              <select value={draft.auth_style} onChange={(event) => setDraft({ ...draft, auth_style: Number(event.target.value) })}>
                <option value={0}>{t('Auto Detect')}</option>
                <option value={1}>{t('Params (in body)')}</option>
                <option value={2}>{t('Header (Basic Auth)')}</option>
              </select>
            </label>
            <AccessPolicyEditor value={draft.access_policy} onChange={(value) => setDraft({ ...draft, access_policy: value })} />
            <label className="field settings-toggle">
              {t('Enabled')}
              <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {t(error)}
              </p>
            )}
            <div className="settings-save">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('Cancel')}
              </Button>
              <Button type="submit">{t(busy ? 'Loading' : 'Save')}</Button>
            </div>
          </fieldset>
        </form>
        <OAuthCallbacks serverAddress={serverAddress} slug={draft.slug || 'provider-slug'} />
      </DialogContent>
    </Dialog>
  )
}
export function CustomOAuthProviders() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const [editing, setEditing] = useState<Provider | null | undefined>(),
    [removing, setRemoving] = useState<Provider | null>(null),
    [busy, setBusy] = useState(false)
  const providers = useQuery({
    queryKey: ['custom-oauth-providers', bundle?.user.id],
    enabled: bundle?.user.role === 100,
    queryFn: async ({ signal }) => {
      const values = await api<Provider[]>('/api/custom-oauth-provider', { signal })
      return values.map(
        (value) => Object.fromEntries(Object.keys({ ...empty, id: 0 }).map((key) => [key, value[key as keyof Provider]])) as unknown as Provider
      )
    },
  })
  const options = queries.getQueryData<Record<string, string>>(['system-options', bundle?.user.id, 'options'])
  function changed() {
    for (const key of ['custom-oauth-providers', 'status']) void queries.invalidateQueries({ queryKey: [key] })
  }
  async function remove() {
    if (!removing) return
    setBusy(true)
    try {
      await api(`/api/custom-oauth-provider/${removing.id}`, { method: 'DELETE' })
      setRemoving(null)
      changed()
      toast.success(t('Saved'))
    } catch (failure) {
      toast.error(t((failure as Error).message))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="console-toolbar">
        <Button onClick={() => setEditing(null)}>{t('Add OAuth Provider')}</Button>
        <Button variant="outline" onClick={() => providers.refetch()}>
          {t('Refresh')}
        </Button>
      </div>
      {providers.error ? (
        <ErrorState error={providers.error} retry={() => providers.refetch()} />
      ) : providers.isPending ? (
        <LoadingState />
      ) : !providers.data.length ? (
        <EmptyState title={t('No OAuth providers configured')} />
      ) : (
        <div className="table-scroll">
          <table className="console-table">
            <thead>
              <tr>
                {['Name', 'Slug', 'Status', 'Actions'].map((label) => (
                  <th key={label}>{t(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.data.map((provider) => (
                <tr key={provider.id}>
                  <td>{provider.name}</td>
                  <td>
                    <code>{provider.slug}</code>
                  </td>
                  <td>{t(provider.enabled ? 'Enabled' : 'Disabled')}</td>
                  <td>
                    <div className="table-actions">
                      <Button size="sm" variant="outline" onClick={() => setEditing(provider)}>
                        {t('Edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(provider)}>
                        {t('Delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && (
        <ProviderForm
          key={editing?.id || 'new'}
          provider={editing}
          serverAddress={options?.ServerAddress || ''}
          onClose={() => setEditing(undefined)}
          onSaved={changed}
        />
      )}
      {removing && (
        <AdminConfirm
          title={`${t('Delete')} ${removing.name}`}
          description={t('Providers with linked users cannot be deleted. Unbind the users first.')}
          busy={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  )
}
