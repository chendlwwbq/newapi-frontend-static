'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm, AdminPagination, AdminSearch } from './shared'
import { MetadataNav } from './metadata-nav'

import { numericFields, type Values, type Description, type Entry, type Snapshot } from './pricing/contracts'
import { LegacyPricePanel } from './pricing/legacy-price-panel'
import { BillingExpressionEditor } from './pricing/expression-editor'
import { PriceBreakdown } from '@/features/catalog/price-breakdown'
import { catalogGroupLabel } from '@/features/catalog/group-label'
import type { PageResult } from '@/lib/api/types'

type PricingChannel = { name: string; models: string; group: string }

type Conversion = Description & { expression?: string; unsupported_reason?: string }

export function ModelPricingPage() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    root = bundle?.user.role === 100
  const [keyword, setKeyword] = useState(''),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<Entry | null>(null)
  const [name, setName] = useState(''),
    [draft, setDraft] = useState<Values>({}),
    [resetting, setResetting] = useState<Entry | null>(null)
  const [expressionEpoch, setExpressionEpoch] = useState(0)
  const [invalidEditors, setInvalidEditors] = useState<Set<string>>(() => new Set())
  const [conversion, setConversion] = useState<Conversion | null>(null)
  const query = useQuery({
    queryKey: ['model-pricing-config', bundle?.user.id],
    enabled: root,
    queryFn: ({ signal }) => api<Snapshot>('/api/option/model_pricing', { signal }),
  })
  function changed() {
    for (const key of ['model-pricing-config', 'catalog', 'catalog-model', 'pricing', 'admin-models'])
      void queries.invalidateQueries({ queryKey: [key] })
    toast.success(t('Saved'))
  }
  const groups = useQuery({
    queryKey: ['pricing-group-labels', bundle?.user.id, bundle?.session.sid],
    enabled: root,
    queryFn: ({ signal }) => api<Record<string, { desc: string }>>('/api/user/self/groups', { signal }),
  })
  const channels = useQuery({
    queryKey: ['pricing-channel-labels', bundle?.user.id, bundle?.session.sid],
    enabled: root,
    queryFn: async ({ signal }) => {
      const rows: PricingChannel[] = []
      for (let page = 1; page <= 10000; page++) {
        const result = await api<PageResult<PricingChannel>>(`/api/channel/?p=${page}&page_size=100`, { signal })
        rows.push(...result.items)
        if (rows.length >= result.total) return rows
        if (!result.items.length) throw new Error('Invalid server response')
      }
      throw new Error('Invalid server response')
    },
  })
  const save = useMutation({
    mutationFn: ({ model_name, version, pricing, reset }: { model_name: string; version: string; pricing: Values; reset?: boolean }) =>
      api('/api/option/model_pricing', { method: 'PATCH', body: { changes: [{ model_name, expected_version: version, pricing, reset }] } }),
    onSuccess: () => {
      setEditor(null)
      setResetting(null)
      changed()
    },
  })
  const preview = useMutation({
    mutationFn: () => api<Description>('/api/option/model_pricing/preview', { method: 'POST', body: { model_name: name.trim(), pricing: draft } }),
  })
  const convert = useMutation({
    mutationFn: () => api<Conversion>('/api/option/model_pricing/convert', { method: 'POST', body: { model_name: name.trim(), pricing: draft } }),
    onSuccess: (value) => setConversion(value),
  })
  const busy = save.isPending || preview.isPending || convert.isPending
  function edit(entry: Entry) {
    setInvalidEditors(new Set())
    setEditor(entry)
    setName(entry.model_name)
    setDraft({ ...entry.configured })
    setConversion(null)
    save.reset()
    preview.reset()
    convert.reset()
  }
  function patch(value: Partial<Values>) {
    setDraft((current) => ({ ...current, ...value }))
    preview.reset()
    convert.reset()
    setConversion(null)
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!editor || invalidEditors.size || Object.values(draft['billing_setting.group_billing_expr'] || {}).some((value) => !value.trim())) return
    save.mutate({ model_name: name.trim(), version: editor.version, pricing: draft })
  }
  const entries = query.data?.entries.filter((entry) => entry.model_name.toLowerCase().includes(keyword.toLowerCase())) || []
  if (!root) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Model pricing')}</h1>
          <p>{t('Manage pricing overrides with native validation and version checks.')}</p>
        </div>
        <Button
          disabled={!query.data}
          onClick={() =>
            edit({ model_name: '', version: query.data!.empty_version, configured: { 'billing_setting.billing_mode': 'tiered_expr' }, effective: {} })
          }
        >
          <Plus size={14} />
          {t('Add pricing')}
        </Button>
      </div>
      <MetadataNav />
      <AdminSearch
        onSearch={(value) => {
          setKeyword(value)
          setPage(1)
        }}
      />
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Model name', 'Billing mode', 'Configured overrides', 'Actions'].map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.slice((page - 1) * 20, page * 20).map((entry) => (
                  <tr key={entry.model_name}>
                    <td>
                      <strong>{entry.model_name}</strong>
                    </td>
                    <td>{t(entry.effective['billing_setting.billing_mode'] === 'tiered_expr' ? 'Expression' : 'Legacy pricing')}</td>
                    <td>{Object.keys(entry.configured).length ? <span className="status-badge">{t('Custom')}</span> : t('Inherited')}</td>
                    <td>
                      <div className="action-buttons">
                        <Button variant="ghost" size="icon" aria-label={`${t('Edit')} ${entry.model_name}`} onClick={() => edit(entry)}>
                          <Pencil size={14} />
                        </Button>
                        {Object.keys(entry.configured).length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${t('Reset pricing overrides')} ${entry.model_name}`}
                            onClick={() => {
                              save.reset()
                              setResetting(entry)
                            }}
                          >
                            <RotateCcw size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!entries.length && <EmptyState />}
          <AdminPagination page={page} total={entries.length} onPage={setPage} />
        </>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !busy) setEditor(null)
        }}
      >
        <DialogContent className="admin-editor pricing-dialog">
          <DialogHeader>
            <DialogTitle>{t('Edit model pricing')}</DialogTitle>
            <DialogDescription>
              {t('Blank values inherit defaults. Zero is an explicit free price. Changes apply only to this model.')}
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <form onSubmit={submit}>
              <fieldset disabled={busy} className="admin-pricing-fields">
                <label className="field">
                  <span>{t('Model name')}</span>
                  <input
                    required
                    maxLength={128}
                    readOnly={!!editor.model_name}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      preview.reset()
                      convert.reset()
                      setConversion(null)
                    }}
                  />
                </label>
                <label className="field">
                  <span>{t('Billing mode')}</span>
                  <select
                    value={draft['billing_setting.billing_mode'] || ''}
                    onChange={(event) =>
                      patch({ 'billing_setting.billing_mode': (event.target.value || undefined) as Values['billing_setting.billing_mode'] })
                    }
                  >
                    <option value="">{t('Inherited')}</option>
                    <option value="tiered_expr">{t('Expression')}</option>
                    <option value="ratio">{t('Legacy pricing')}</option>
                  </select>
                </label>
                <BillingExpressionEditor
                  key={`${editor.model_name}:${expressionEpoch}`}
                  value={draft['billing_setting.billing_expr'] || ''}
                  schema={editor.usage_schema}
                  onChange={(value) => patch({ 'billing_setting.billing_expr': value || undefined })}
                  onValidityChange={(valid) =>
                    setInvalidEditors((previous) => {
                      const next = new Set(previous)
                      if (valid) next.delete('model')
                      else next.add('model')
                      return next
                    })
                  }
                />
                <details className="admin-advanced" open={draft['billing_setting.billing_mode'] === 'ratio'}>
                  <summary>{t('Legacy pricing')}</summary>
                  <div className="admin-form-grid">
                    {Object.entries(numericFields).map(([key, label]) => (
                      <label className="field" key={key}>
                        <span>{t(label)}</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          placeholder={t('Inherited')}
                          value={draft[key as keyof typeof numericFields] ?? ''}
                          onChange={(event) => patch({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })}
                        />
                      </label>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!name.trim() || convert.isPending || save.isPending}
                    onClick={() => convert.mutate()}
                  >
                    {t('Preview expression conversion')}
                  </Button>
                  {convert.error && <ErrorState error={convert.error} />}
                </details>
                {editor.plugin_variants?.map((variant) => (
                  <fieldset className="admin-advanced" key={variant.plugin_key}>
                    <legend>
                      {variant.plugin_name} {variant.stale ? `· ${t('Unavailable')}` : ''}
                    </legend>
                    <BillingExpressionEditor
                      key={`${editor.model_name}:${variant.plugin_key}`}
                      value={draft['billing_setting.plugin_billing_expr']?.[variant.plugin_key] || ''}
                      schema={variant.usage_schema}
                      readOnly={variant.stale}
                      onChange={(value) => {
                        const next = { ...draft['billing_setting.plugin_billing_expr'] }
                        if (value) next[variant.plugin_key] = value
                        else delete next[variant.plugin_key]
                        patch({ 'billing_setting.plugin_billing_expr': next })
                      }}
                      onValidityChange={(valid) =>
                        setInvalidEditors((previous) => {
                          const next = new Set(previous)
                          if (valid) next.delete(variant.plugin_key)
                          else next.add(variant.plugin_key)
                          return next
                        })
                      }
                    />
                    {variant.stale && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const next = { ...draft['billing_setting.plugin_billing_expr'] }
                          delete next[variant.plugin_key]
                          patch({ 'billing_setting.plugin_billing_expr': next })
                        }}
                      >
                        {t('Remove')}
                      </Button>
                    )}
                    <details>
                      <summary className="small-note">{t('Usage schema')}</summary>
                      <pre className="admin-pricing-effective">{JSON.stringify(variant.usage_schema, null, 2)}</pre>
                    </details>
                  </fieldset>
                ))}
                {Object.entries(draft['billing_setting.group_billing_expr'] || {}).length > 0 && (
                  <section className="admin-advanced">
                    <h3>{t('Route prices')}</h3>
                    <p className="small-note">{t('These are base USD prices before group discounts and currency conversion.')}</p>
                    {Object.entries(draft['billing_setting.group_billing_expr'] || {}).map(([group, expression]) => (
                      <details key={group} className="admin-advanced">
                        <summary>
                          {catalogGroupLabel(
                            group,
                            t,
                            groups.data?.[group]?.desc ||
                              channels.data?.find(
                                (channel) =>
                                  channel.group
                                    .split(',')
                                    .map((value) => value.trim())
                                    .includes(group) &&
                                  channel.models
                                    .split(',')
                                    .map((value) => value.trim())
                                    .includes(editor.model_name)
                              )?.name
                          )}{' '}
                          <code>{group}</code>
                        </summary>
                        <PriceBreakdown
                          quote={{
                            currency: 'USD',
                            status: expression.trim() ? 'dynamic' : 'unconfigured',
                            group,
                            billing_group_scoped: true,
                            billing_expr: expression,
                            components: [],
                          }}
                        />
                        <BillingExpressionEditor
                          key={`${editor.model_name}:group:${group}`}
                          value={expression}
                          onChange={(value) =>
                            patch({ 'billing_setting.group_billing_expr': { ...draft['billing_setting.group_billing_expr'], [group]: value } })
                          }
                          onValidityChange={(valid) =>
                            setInvalidEditors((previous) => {
                              const next = new Set(previous)
                              if (valid) next.delete(`group:${group}`)
                              else next.add(`group:${group}`)
                              return next
                            })
                          }
                        />
                        {!expression.trim() && <p role="alert">{t('A route price cannot be blank.')}</p>}
                      </details>
                    ))}
                  </section>
                )}
                {!!editor.usage_schema && (
                  <details className="admin-advanced">
                    <summary>{t('Usage schema')}</summary>
                    <pre className="admin-pricing-effective">{JSON.stringify(editor.usage_schema, null, 2)}</pre>
                  </details>
                )}
                <LegacyPricePanel description={editor} />
                <details className="admin-advanced">
                  <summary>{t('Current effective pricing')}</summary>
                  <pre className="admin-pricing-effective">{JSON.stringify(editor.effective, null, 2)}</pre>
                </details>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!name.trim() || preview.isPending || save.isPending || !!invalidEditors.size}
                  onClick={() => preview.mutate()}
                >
                  {t('Preview effective pricing')}
                </Button>
                {preview.error && <ErrorState error={preview.error} />}{' '}
                {preview.data && (
                  <div role="status">
                    <LegacyPricePanel description={preview.data} />
                    <details>
                      <summary>{t('Raw JSON')}</summary>
                      <pre className="admin-pricing-effective">{JSON.stringify(preview.data, null, 2)}</pre>
                    </details>
                  </div>
                )}
                {save.error && <ErrorState error={save.error} />}
                <DialogFooter>
                  <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditor(null)}>
                    {t('Cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      save.isPending ||
                      !name.trim() ||
                      !!invalidEditors.size ||
                      Object.values(draft['billing_setting.group_billing_expr'] || {}).some((value) => !value.trim())
                    }
                  >
                    {t('Save')}
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!conversion}
        onOpenChange={(open) => {
          if (!open) setConversion(null)
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Preview expression conversion')}</DialogTitle>
            <DialogDescription>{t('Review the conversion before replacing the draft. Saving remains a separate step.')}</DialogDescription>
          </DialogHeader>
          {conversion && (
            <>
              {conversion.unsupported_reason && <p role="alert">{t(conversion.unsupported_reason)}</p>}
              <LegacyPricePanel description={conversion} />
              <details>
                <summary>{t('Raw JSON')}</summary>
                <pre className="admin-pricing-effective">{JSON.stringify(conversion.effective, null, 2)}</pre>
              </details>
              <pre className="admin-pricing-effective">{conversion.expression}</pre>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConversion(null)}>
                  {t('Cancel')}
                </Button>
                <Button
                  disabled={!conversion.expression}
                  onClick={() => {
                    setExpressionEpoch((previous) => previous + 1)
                    setInvalidEditors(new Set())
                    patch({ 'billing_setting.billing_mode': 'tiered_expr', 'billing_setting.billing_expr': conversion.expression })
                  }}
                >
                  {t('Use expression')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {resetting && (
        <>
          <AdminConfirm
            title={t('Reset pricing overrides')}
            description={`${resetting.model_name} · ${t('Remove this model’s saved overrides and inherit native defaults.')}${Object.keys(resetting.configured['billing_setting.group_billing_expr'] || {}).length ? ` ${t('This also removes all saved route prices for this model.')}` : ''}${Object.keys(resetting.configured['billing_setting.plugin_billing_expr'] || {}).length ? ` ${t('This also removes all saved plugin prices for this model.')}` : ''}`}
            busy={save.isPending}
            onClose={() => setResetting(null)}
            onConfirm={() => save.mutate({ model_name: resetting.model_name, version: resetting.version, pricing: {}, reset: true })}
          />
          {save.error && <ErrorState error={save.error} />}
        </>
      )}
    </>
  )
}
