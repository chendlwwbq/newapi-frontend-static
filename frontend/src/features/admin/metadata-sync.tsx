'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { api, ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/shared/states'
import { AdminPagination } from './shared'
import { MetadataNav } from './metadata-nav'

type Field = 'description' | 'icon' | 'tags' | 'vendor' | 'endpoints' | 'name_rule' | 'status'
type Candidate = {
  model_name: string
  kind: 'create' | 'update' | 'unchanged' | 'blocked' | 'missing_upstream' | 'missing_vendor'
  scope: 'site' | 'catalog'
  record_version: string
  vendor_to_create?: string
  fields: { field: Field; local: string | number; upstream: string | number }[]
}
type Preview = { source: { locale: string; models_url: string; vendors_url: string; version: string }; candidates: Candidate[] }
const fields: Record<Field, string> = {
  description: 'Description',
  icon: 'Icon',
  tags: 'Tags',
  vendor: 'Vendor',
  endpoints: 'Custom endpoints',
  name_rule: 'Name matching rule',
  status: 'Status',
}
const kinds = {
  create: 'Create',
  update: 'Update',
  unchanged: 'Unchanged',
  blocked: 'Official sync disabled',
  missing_upstream: 'Not in upstream catalog',
  missing_vendor: 'Upstream vendor missing',
}

export function MetadataSyncPage() {
  const { t } = useTranslation(),
    queries = useQueryClient()
  const [locale, setLocale] = useState('zh'),
    [preview, setPreview] = useState<Preview | null>(null)
  const [selection, setSelection] = useState<Record<string, Field[]>>({}),
    [keyword, setKeyword] = useState(''),
    [scope, setScope] = useState('site'),
    [page, setPage] = useState(1),
    [stale, setStale] = useState(false)
  const load = useMutation({
    mutationFn: () => api<Preview>(`/api/models/sync_upstream/preview?locale=${locale}`),
    onSuccess: (value) => {
      setPreview(value)
      setPage(1)
      setSelection({})
      setStale(false)
      apply.reset()
    },
  })
  const apply = useMutation({
    mutationFn: () =>
      api<{ created_models: string[]; updated_models: unknown[]; created_vendors: string[] }>('/api/models/sync_upstream', {
        method: 'POST',
        body: {
          locale: preview!.source.locale,
          source_version: preview!.source.version,
          selections: preview!.candidates
            .filter((item) => selection[item.model_name]?.length)
            .map((item) => ({
              model_name: item.model_name,
              record_version: item.record_version,
              create: item.kind === 'create',
              fields: selection[item.model_name],
            })),
        },
      }),
    onSuccess: () => {
      setStale(true)
      setSelection({})
      toast.success(t('Saved'))
      for (const key of ['admin-models', 'admin-vendors', 'admin-vendor-options', 'catalog']) void queries.invalidateQueries({ queryKey: [key] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) setStale(true)
    },
  })
  const visible =
    preview?.candidates.filter((item) => (!scope || item.scope === scope) && item.model_name.toLowerCase().includes(keyword.toLowerCase())) || []
  const selected = Object.values(selection).filter((value) => value.length).length
  function toggle(item: Candidate, field?: Field) {
    setSelection((current) => {
      const previous = current[item.model_name] || []
      return {
        ...current,
        [item.model_name]: field
          ? previous.includes(field)
            ? previous.filter((value) => value !== field)
            : [...previous, field]
          : previous.length === item.fields.length
            ? []
            : item.fields.map((value) => value.field),
      }
    })
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Metadata sync')}</h1>
          <p>{t('Preview upstream changes and choose the fields to apply.')}</p>
        </div>
      </div>
      <MetadataNav />
      <div className="admin-notice">
        {t('Metadata sync changes catalog information only. Channel configuration and model prices are managed separately.')}
      </div>
      <div className="console-toolbar admin-toolbar admin-sync-controls">
        <label className="field">
          <span>{t('Language')}</span>
          <select
            value={locale}
            disabled={load.isPending || apply.isPending}
            onChange={(event) => {
              setLocale(event.target.value)
              setPreview(null)
              setSelection({})
              load.reset()
              apply.reset()
            }}
          >
            <option value="zh">简体中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </label>
        <Button disabled={load.isPending || apply.isPending} onClick={() => load.mutate()}>
          {t(load.isPending ? 'Loading' : 'Preview changes')}
        </Button>
      </div>
      {load.error && <ErrorState error={load.error} />}
      {preview && (
        <>
          <div className="admin-sync-source small-note">
            <a href={preview.source.models_url} target="_blank" rel="noreferrer">
              {t('Model metadata source')} ↗
            </a>
            <a href={preview.source.vendors_url} target="_blank" rel="noreferrer">
              {t('Vendor metadata source')} ↗
            </a>
          </div>
          <div className="console-toolbar admin-toolbar">
            <label className="search-field">
              <Search size={15} />
              <input
                aria-label={t('Search')}
                placeholder={t('Search')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <select
              className="plain-select"
              aria-label={t('Scope')}
              value={scope}
              onChange={(event) => {
                setScope(event.target.value)
                setPage(1)
              }}
            >
              <option value="site">{t('Site models')}</option>
              <option value="catalog">{t('Upstream catalog')}</option>
              <option value="">{t('All')}</option>
            </select>
            <span className="small-note">
              {visible.length} / {preview.candidates.length}
            </span>
          </div>
          <div className="admin-selection">
            <span>
              {t('Selected models')}: {selected}
            </span>
            <Button
              variant="outline"
              disabled={apply.isPending || stale}
              onClick={() =>
                setSelection((current) => ({
                  ...current,
                  ...Object.fromEntries(
                    visible
                      .filter((item) => item.kind === 'create' || item.kind === 'update')
                      .map((item) => [item.model_name, item.fields.map((field) => field.field)])
                  ),
                }))
              }
            >
              {t('Select visible changes')}
            </Button>
            <Button variant="outline" disabled={apply.isPending} onClick={() => setSelection({})}>
              {t('Clear selection')}
            </Button>
            <Button disabled={!selected || stale || load.isPending || apply.isPending} onClick={() => apply.mutate()}>
              {t('Apply selected changes')}
            </Button>
          </div>
          {stale && (
            <p className="admin-notice" role="status">
              {t('Preview again before applying more changes.')}
            </p>
          )}
          {apply.error && <ErrorState error={apply.error} />}
          {apply.data && (
            <p role="status">
              {t('Created')}: {apply.data.created_models.length} · {t('Updated')}: {apply.data.updated_models.length} · {t('Vendors')}:{' '}
              {apply.data.created_vendors.length}
            </p>
          )}
          <div className="admin-sync-list">
            {visible.slice((page - 1) * 20, page * 20).map((item) => (
              <details className="admin-sync-item" key={item.model_name}>
                <summary>
                  <label className="checkbox-label" onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={`${t('Select')} ${item.model_name}`}
                      type="checkbox"
                      checked={!!selection[item.model_name]?.length}
                      disabled={stale || load.isPending || apply.isPending || !['create', 'update'].includes(item.kind)}
                      onChange={() => toggle(item)}
                    />
                    <strong>{item.model_name}</strong>
                  </label>
                  <span className="status-badge">{t(kinds[item.kind])}</span>
                </summary>
                {item.kind === 'create' && <p className="small-note">{t('New records import all upstream fields.')}</p>}
                {item.vendor_to_create && (
                  <p className="small-note">
                    {t('Vendor to create')}: {item.vendor_to_create}
                  </p>
                )}
                {item.fields.length > 0 && (
                  <div className="table-wrap">
                    <table className="data-table admin-sync-table">
                      <thead>
                        <tr>
                          <th>{t('Field')}</th>
                          <th>{t('Current value')}</th>
                          <th>{t('Upstream value')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.fields.map((field) => (
                          <tr key={field.field}>
                            <td>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={selection[item.model_name]?.includes(field.field) || false}
                                  disabled={stale || load.isPending || apply.isPending || item.kind === 'create'}
                                  onChange={() => toggle(item, field.field)}
                                />
                                {t(fields[field.field])}
                              </label>
                            </td>
                            <td>
                              <pre>{String(field.local ?? '')}</pre>
                            </td>
                            <td>
                              <pre>{String(field.upstream ?? '')}</pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            ))}
          </div>
          <AdminPagination page={page} total={visible.length} onPage={setPage} />
        </>
      )}
    </>
  )
}
