'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult, Token } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminSearch, AdminPagination } from '@/features/admin/shared'
import { parseChatConfig, chatLinkRequiresApiKey, type ChatPreset } from './chat-links'
import { clientDestination, resolveClientUrl, ccSwitchUrl } from './client-destination'
import { SecurityDialog } from '@/features/auth/secure-verification/security-dialog'

export function ClientConnection({
  preset,
  address,
  onClose,
  initialApp,
  initialModel,
  requiredGroup,
}: {
  preset: ChatPreset
  address: string
  onClose: () => void
  initialApp?: 'claude' | 'codex'
  initialModel?: string
  requiredGroup?: string
}) {
  const { t } = useTranslation(),
    { bundle } = useAuth()
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [selected, setSelected] = useState<Token | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [prepared, setPrepared] = useState(''),
    [verifyKey, setVerifyKey] = useState(false)
  const isCCSwitch = preset.url === 'ccswitch'
  const [app, setApp] = useState<'claude' | 'codex' | 'gemini'>(initialApp || 'claude'),
    [name, setName] = useState('eva'),
    [models, setModels] = useState<Record<string, string>>(initialModel ? { model: initialModel } : {})
  const modelList = useQuery({
    queryKey: ['client-models', bundle?.user.id, bundle?.session.sid],
    enabled: isCCSwitch,
    queryFn: ({ signal }) => api<string[]>('/api/user/models', { signal }),
  })
  let destination: ReturnType<typeof clientDestination> | undefined
  try {
    destination = clientDestination(preset.url, address)
  } catch {
    /* Render the unsupported destination below. */
  }
  const needsKey = chatLinkRequiresApiKey(preset.url) || destination?.type === 'fluent' || isCCSwitch
  const tokens = useQuery({
    queryKey: ['chat-tokens', bundle?.user.id, bundle?.session.sid, keyword, page],
    enabled: !!destination && needsKey,
    queryFn: ({ signal }) =>
      api<PageResult<Token>>(`/api/token/${keyword ? `search?keyword=${encodeURIComponent(keyword)}&` : '?'}p=${page}&size=20`, { signal }),
  })
  async function prepare(proof?: string, signal?: AbortSignal) {
    if (!destination || (needsKey && (!selected || !consent)) || (isCCSwitch && !models.model)) return
    setBusy(true)
    try {
      const result = needsKey
        ? await api<{ key: string }>(`/api/token/${selected!.id}/key`, { method: 'POST', headers: { 'X-Security-Proof': proof || '' }, signal })
        : null
      signal?.throwIfAborted()
      if (destination.type === 'fluent') {
        const container = document.getElementById('fluent-new-api-container')
        if (!container) throw new Error('Fluent integration is not available')
        const key = result!.key.startsWith('sk-') ? result!.key : `sk-${result!.key}`
        container.dispatchEvent(new CustomEvent('fluent:prefill', { detail: { id: 'new-api', baseUrl: address, apiKey: key } }))
        toast.success(t('Saved'))
        onClose()
      } else setPrepared(isCCSwitch ? ccSwitchUrl(address, app, name, models, result!.key) : resolveClientUrl(preset.url, address, result?.key || ''))
    } catch (error) {
      if (signal) throw error
      toast.error(t((error as Error).message))
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
      <DialogContent className="admin-editor" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{preset.name}</DialogTitle>
          <DialogDescription>{t('Review the destination before connecting a client.')}</DialogDescription>
        </DialogHeader>
        {!destination ? (
          <EmptyState title={t('Unsupported client destination')} />
        ) : (
          <>
            <dl className="ops-details">
              <div>
                <dt>{t('Destination')}</dt>
                <dd>{destination.target}</dd>
              </div>
              <div>
                <dt>{t('Base URL')}</dt>
                <dd>{address}</dd>
              </div>
            </dl>
            {prepared ? (
              <>
                <p className="admin-notice">{t(needsKey ? 'Ready to open. The selected API key will be sent to this client.' : 'Ready to open.')}</p>
                <Button
                  onClick={() => {
                    window.open(prepared, '_blank', 'noopener,noreferrer')
                    onClose()
                  }}
                >
                  {t('Open client')}
                </Button>
              </>
            ) : (
              <fieldset className="admin-pricing-fields" disabled={busy}>
                {isCCSwitch && (
                  <>
                    <label className="field">
                      <span>{t('Application')}</span>
                      <select
                        value={app}
                        disabled={!!initialApp}
                        onChange={(event) => {
                          setApp(event.target.value as 'claude' | 'codex' | 'gemini')
                          setModels({})
                        }}
                      >
                        {['claude', 'codex', 'gemini'].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>{t('Name')}</span>
                      <input value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
                    {modelList.error ? (
                      <ErrorState error={modelList.error} retry={() => modelList.refetch()} />
                    ) : modelList.isPending ? (
                      <LoadingState />
                    ) : (
                      (app === 'claude'
                        ? [
                            ['model', 'Primary Model'],
                            ['haikuModel', 'Haiku Model'],
                            ['sonnetModel', 'Sonnet Model'],
                            ['opusModel', 'Opus Model'],
                          ]
                        : [['model', 'Primary Model']]
                      ).map(([field, label]) => (
                        <label className="field" key={field}>
                          <span>{t(label)}</span>
                          <select
                            value={models[field] || ''}
                            disabled={!!initialModel && field === 'model'}
                            onChange={(event) => setModels({ ...models, [field]: event.target.value })}
                          >
                            <option value="">—</option>
                            {initialModel && !modelList.data?.includes(initialModel) && <option value={initialModel}>{initialModel}</option>}
                            {modelList.data?.map((model) => (
                              <option value={model} key={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))
                    )}
                  </>
                )}
                {needsKey && (
                  <>
                    {requiredGroup && (
                      <p className="small-note">
                        {t('Create a key in the selected group to use this route.')} {t('Group')}: {requiredGroup}
                      </p>
                    )}
                    <p className="admin-notice">
                      {t('This client will receive the selected API key and can make requests using its permissions and quota.')}
                    </p>
                    <AdminSearch
                      onSearch={(value) => {
                        setKeyword(value)
                        setPage(1)
                      }}
                    />
                    {tokens.error ? (
                      <ErrorState error={tokens.error} retry={() => tokens.refetch()} />
                    ) : tokens.isPending ? (
                      <LoadingState />
                    ) : (
                      <>
                        <div className="client-key-list">
                          {tokens.data.items.map((token) => {
                            const available =
                              (!requiredGroup || token.group === requiredGroup) &&
                              token.status === 1 &&
                              (token.expired_time === -1 || token.expired_time > Date.now() / 1000) &&
                              (token.unlimited_quota || token.remain_quota > 0)
                            return (
                              <label className="checkbox-label" key={token.id}>
                                <input
                                  type="radio"
                                  name="client-key"
                                  disabled={!available}
                                  checked={selected?.id === token.id}
                                  onChange={() => {
                                    setSelected(token)
                                    setConsent(false)
                                  }}
                                />
                                <span>
                                  {token.name}{' '}
                                  <small className="small-note">
                                    #{token.id} · {token.group} · {t(available ? 'Enabled' : 'Unavailable')}
                                  </small>
                                </span>
                              </label>
                            )
                          })}
                        </div>
                        {!tokens.data.items.length && <EmptyState />}
                        <AdminPagination page={page} total={tokens.data.total} onPage={setPage} />
                      </>
                    )}
                    <Link href="/keys" className="text-link">
                      {t('Manage API keys')} ↗
                    </Link>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                      {t('Share the selected API key with this client')}
                    </label>
                  </>
                )}
                <Button
                  disabled={busy || (needsKey && (!selected || !consent)) || (isCCSwitch && !models.model)}
                  onClick={() => {
                    if (needsKey) setVerifyKey(true)
                    else void prepare()
                  }}
                >
                  {t(busy ? 'Loading' : needsKey ? 'Prepare connection' : 'Continue')}
                </Button>
              </fieldset>
            )}
          </>
        )}
        {verifyKey && selected && (
          <SecurityDialog
            operation={{ scope: 'api_key.read_secret', context: { token_ids: [selected.id] } }}
            title="View keys"
            onClose={() => setVerifyKey(false)}
            onAuthorized={(proof, signal) => prepare(proof, signal)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
export function ChatClients({ selectedId, firstWeb = false }: { selectedId?: string; firstWeb?: boolean }) {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    [origin, setOrigin] = useState(''),
    [chosen, setChosen] = useState<string | null>(null)
  useEffect(() => setOrigin(location.origin), [])
  const status = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => api<{ chats?: string; server_address?: string }>('/api/status', { signal, anonymous: true }),
  })
  if (status.error) return <ErrorState error={status.error} retry={() => status.refetch()} />
  if (status.isPending || !origin) return <LoadingState />
  const presets = parseChatConfig(status.data.chats),
    address = status.data.server_address || origin
  const preferred = selectedId ?? (firstWeb ? presets.find((item) => item.type === 'web')?.id : undefined)
  const selected = presets.find((item) => item.id === chosen)
  const ordered = [...presets].sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred))
  return (
    <section className="console-panel">
      <h2>{t('Chat clients')}</h2>
      <p className="small-note">{t('Connect a configured client using a key you choose.')}</p>
      {!ordered.length ? (
        <EmptyState title={t('No clients configured')} />
      ) : (
        <div className="client-grid">
          {ordered.map((preset) => (
            <article key={preset.id}>
              <strong>{preset.name}</strong>
              <span className="small-note">{t(preset.type === 'web' ? 'Web client' : 'Desktop client')}</span>
              <Button variant="outline" onClick={() => setChosen(preset.id)}>
                {t('Connect')}
              </Button>
            </article>
          ))}
        </div>
      )}
      {selected && bundle && (
        <ClientConnection
          key={`${bundle.user.id}:${bundle.session.sid}:${selected.id}`}
          preset={selected}
          address={address}
          onClose={() => setChosen(null)}
        />
      )}
    </section>
  )
}
