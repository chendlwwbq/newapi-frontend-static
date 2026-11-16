'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminSearch, AdminPagination } from '../shared'
import { MetadataNav } from '../metadata-nav'
import { syncPricingChange, type SyncChannel, type SyncResult, type Snapshot, type PricingChange } from './contracts'
import { adjustSyncPrice, type PriceAdjustment } from './price-adjustment'

export function PricingSyncPage() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    root = bundle?.user.role === 100,
    queries = useQueryClient()
  const [sources, setSources] = useState<Record<number, string>>({}),
    [keyword, setKeyword] = useState(''),
    [page, setPage] = useState(1)
  const [selections, setSelections] = useState<Record<string, { source: string; mode: PriceAdjustment }>>({}),
    [rate, setRate] = useState('1')
  const [preview, setPreview] = useState<{
    changes: PricingChange[]
    sources: Record<string, { source: string; mode: PriceAdjustment }>
    rate: string
  } | null>(null)
  const channels = useQuery({
    queryKey: ['pricing-sync-channels', bundle?.user.id],
    enabled: root,
    queryFn: ({ signal }) => api<SyncChannel[]>('/api/ratio_sync/channels', { signal }),
  })
  const load = useMutation({
    mutationFn: async () => {
      const upstreams = channels
        .data!.filter((channel) => sources[channel.id] !== undefined)
        .map((channel) => ({ id: channel.id, name: channel.name, base_url: channel.base_url, endpoint: sources[channel.id] }))
      const [snapshot, result] = await Promise.all([
        api<Snapshot>('/api/option/model_pricing'),
        api<SyncResult>('/api/ratio_sync/fetch', { method: 'POST', body: { upstreams, timeout: 10, include_unchanged: true } }),
      ])
      return { snapshot, result }
    },
    onMutate: () => {
      setSelections({})
      setPreview(null)
      save.reset()
      setPage(1)
    },
  })
  const save = useMutation({
    mutationFn: (changes: PricingChange[]) => api('/api/option/model_pricing', { method: 'PATCH', body: { changes } }),
    onSuccess: () => {
      setPreview(null)
      setSelections({})
      load.reset()
      toast.success(t('Prices synced successfully'))
      for (const key of ['model-pricing-config', 'catalog', 'catalog-model', 'pricing', 'admin-models'])
        void queries.invalidateQueries({ queryKey: [key] })
    },
  })
  const rows = Object.entries(load.data?.result.prices || {}).filter(([name]) => name.toLowerCase().includes(keyword.toLowerCase())),
    visible = rows.slice((page - 1) * 20, page * 20)
  const busy = load.isPending || save.isPending
  if (!root) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Upstream price sync')}</h1>
          <p>{t('Fetch source prices, compare complete model prices, then confirm a version-checked import.')}</p>
        </div>
      </div>
      <MetadataNav />
      <fieldset className="console-panel plugin-form" disabled={busy}>
        <h2>{t('Pricing sources')}</h2>
        {channels.error ? (
          <ErrorState error={channels.error} retry={() => channels.refetch()} />
        ) : channels.isPending ? (
          <LoadingState />
        ) : (
          channels.data.map((channel) => (
            <div className="pricing-source" key={channel.id}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={sources[channel.id] !== undefined}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setSources((previous) => {
                      const next = { ...previous }
                      if (checked)
                        next[channel.id] =
                          channel.id === -100
                            ? '/llm-metadata/api/newapi/ratio_config-v1-base.json'
                            : channel.id === -101
                              ? 'https://models.dev/api.json'
                              : channel.type === 20
                                ? 'openrouter'
                                : '/api/pricing'
                      else delete next[channel.id]
                      return next
                    })
                  }}
                />
                {channel.name}
              </label>
              <small>{channel.base_url}</small>
              {sources[channel.id] !== undefined && (
                <Input
                  aria-label={`${channel.name} ${t('Endpoint')}`}
                  list="pricing-sync-endpoints"
                  value={sources[channel.id]}
                  onChange={(event) => setSources((previous) => ({ ...previous, [channel.id]: event.target.value }))}
                />
              )}
            </div>
          ))
        )}
        <datalist id="pricing-sync-endpoints">
          {['/api/pricing', '/api/ratio_config', 'openrouter'].map((endpoint) => (
            <option value={endpoint} key={endpoint} />
          ))}
        </datalist>
        <Button
          type="button"
          disabled={!Object.keys(sources).length || Object.values(sources).some((endpoint) => !endpoint.trim())}
          onClick={() => load.mutate()}
        >
          {t('Fetch upstream prices')}
        </Button>
      </fieldset>
      {load.error && <ErrorState error={load.error} />}
      {load.data?.result.test_results.map((result) => (
        <p key={result.name} className="small-note" role={result.status === 'error' ? 'alert' : undefined}>
          {result.name} · {t(result.status === 'error' ? 'Failed' : 'Success')}
          {result.error && ` · ${t(result.error)}`}
        </p>
      ))}
      {load.data && (
        <>
          <div className="console-panel">
            <AdminSearch
              onSearch={(value) => {
                setKeyword(value)
                setPage(1)
              }}
            />
            <div className="action-buttons">
              <label className="field">
                <span>{t('Price adjustment factor')}</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={rate}
                  onChange={(event) => {
                    setRate(event.target.value)
                    setPreview(null)
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSelections((previous) => ({
                    ...previous,
                    ...Object.fromEntries(
                      visible
                        .filter(([, row]) => Object.keys(row.upstreams).length === 1)
                        .map(([model, row]) => [model, { source: Object.keys(row.upstreams)[0], mode: 'keep' as const }])
                    ),
                  }))
                }
              >
                {t('Select single-source models on this page')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSelections({})}>
                {t('Clear selection')}
              </Button>
            </div>
            <p className="small-note">
              {t('Imports replace model-level pricing fields and preserve provider overrides. Adjustments change prices, not display currency.')}
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Model name', 'Current effective pricing', 'Source price', 'Adjustment'].map((label) => (
                      <th key={label}>{t(label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(([model, row]) => {
                    const selection = selections[model],
                      quote = selection && row.upstreams[selection.source],
                      adjusted = quote && adjustSyncPrice(quote, selection.mode, Number(rate) || null)
                    return (
                      <tr key={model}>
                        <td>
                          <strong>{model}</strong>
                        </td>
                        <td>
                          <pre className="pricing-quote">{JSON.stringify(row.current, null, 2)}</pre>
                        </td>
                        <td>
                          <select
                            aria-label={`${model} ${t('Select source')}`}
                            value={selection?.source || ''}
                            onChange={(event) => {
                              const source = event.target.value
                              setSelections((previous) => {
                                const next = { ...previous }
                                if (source) next[model] = { source, mode: previous[model]?.mode || 'keep' }
                                else delete next[model]
                                return next
                              })
                            }}
                          >
                            <option value="">{t('Not selected')}</option>
                            {Object.keys(row.upstreams).map((source) => (
                              <option key={source}>{source}</option>
                            ))}
                          </select>
                          {quote && <pre className="pricing-quote">{JSON.stringify(adjusted?.values || quote, null, 2)}</pre>}
                          {adjusted?.error && <p role="alert">{t(adjusted.error)}</p>}
                        </td>
                        <td>
                          {selection && (
                            <select
                              aria-label={`${model} ${t('Adjustment')}`}
                              value={selection.mode}
                              onChange={(event) =>
                                setSelections((previous) => ({ ...previous, [model]: { ...selection, mode: event.target.value as PriceAdjustment } }))
                              }
                            >
                              <option value="keep">{t('Keep source price')}</option>
                              <option value="multiply">× {rate}</option>
                              <option value="divide">÷ {rate}</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!rows.length && <EmptyState />}
            <AdminPagination page={page} total={rows.length} onPage={setPage} />
            <Button
              disabled={!Object.keys(selections).length}
              onClick={() => {
                try {
                  const changes = Object.entries(selections).map(([model, selection]) => {
                    const result = adjustSyncPrice(load.data.result.prices[model].upstreams[selection.source], selection.mode, Number(rate) || null)
                    if (result.error) throw new Error(result.error)
                    return syncPricingChange(load.data.snapshot, model, result.values!)
                  })
                  save.reset()
                  setPreview({ changes, sources: structuredClone(selections), rate })
                } catch (error) {
                  toast.error(t((error as Error).message))
                }
              }}
            >
              {t('Review changes')} · {Object.keys(selections).length}
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setPreview(null)
        }}
      >
        <DialogContent className="admin-editor pricing-dialog">
          <DialogHeader>
            <DialogTitle>{t('Review price import')}</DialogTitle>
            <DialogDescription>{t('Review every replacement before saving. Conflicting versions require fetching prices again.')}</DialogDescription>
          </DialogHeader>
          {preview && (
            <>
              <p className="small-note">
                {t('Price adjustment factor')}: {preview.rate}
              </p>
              {preview.changes.map((change) => (
                <section className="pricing-tier" key={change.model_name}>
                  <h3>
                    {change.model_name} · {preview.sources[change.model_name].source}
                  </h3>
                  <div className="admin-form-grid">
                    <div>
                      <strong>{t('Configured overrides')}</strong>
                      <pre className="admin-pricing-effective">
                        {JSON.stringify(
                          load.data?.snapshot.entries.find((entry) => entry.model_name === change.model_name)?.configured || {},
                          null,
                          2
                        )}
                      </pre>
                    </div>
                    <div>
                      <strong>{t('New pricing')}</strong>
                      <pre className="admin-pricing-effective">{JSON.stringify(change.pricing, null, 2)}</pre>
                    </div>
                  </div>
                </section>
              ))}
              {save.error && <ErrorState error={save.error} />}
              <DialogFooter>
                <Button variant="outline" disabled={save.isPending} onClick={() => setPreview(null)}>
                  {t('Cancel')}
                </Button>
                <Button disabled={save.isPending} onClick={() => save.mutate(preview.changes)}>
                  {t('Confirm import')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
