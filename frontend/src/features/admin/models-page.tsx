'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Eye, EyeOff, Trash2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm, AdminPagination, AdminSearch } from './shared'
import { MetadataNav } from './metadata-nav'
import { PrefillSelect } from './prefill-select'
import { ModelBatchActions } from './model-batch-actions'
import type { ModelMetadata, VendorMetadata } from './metadata-types'

const blank: ModelMetadata = {
  id: 0,
  model_name: '',
  description: '',
  icon: '',
  tags: '',
  vendor_id: 0,
  endpoints: '',
  status: 1,
  sync_official: 0,
  name_rule: 0,
}
const rules = ['Exact Match', 'Prefix Match', 'Contains Match', 'Suffix Match']
const visibility = { visible: 'Visible', unavailable: 'Unavailable', hidden: 'Hidden', partial: 'Partial' }
export function ModelsPage() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [filter, setFilter] = useState(''),
    [state, setState] = useState('')
  const [selected, setSelected] = useState<Record<number, ModelMetadata>>({})
  const [editor, setEditor] = useState<ModelMetadata | null>(null),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState<ModelMetadata | null>(null)
  const query = useQuery({
    queryKey: ['admin-models', bundle?.user.id, page, keyword, state],
    queryFn: ({ signal }) =>
      api<PageResult<ModelMetadata>>(
        `/api/models/search?${new URLSearchParams({ p: String(page), page_size: '20', keyword, square_state: state, include_channel_models: 'true' })}`,
        { signal }
      ),
  })
  const vendors = useQuery({
    queryKey: ['admin-vendor-options', bundle?.user.id],
    enabled: !!editor,
    queryFn: () => api<PageResult<VendorMetadata>>('/api/vendors/?page_size=1000'),
  })
  function changed() {
    void queries.invalidateQueries({ queryKey: ['admin-models'] })
    void queries.invalidateQueries({ queryKey: ['catalog'] })
    void queries.invalidateQueries({ queryKey: ['admin-vendors'] })
    toast.success(t('Saved'))
  }
  const save = useMutation({
    mutationFn: (value: ModelMetadata) =>
      api('/api/models/', {
        method: value.id ? 'PUT' : 'POST',
        body: {
          id: value.id || undefined,
          model_name: value.model_name,
          description: value.description,
          icon: value.icon,
          tags: value.tags,
          vendor_id: value.vendor_id,
          endpoints: value.endpoints,
          status: value.status,
          sync_official: value.sync_official,
          name_rule: value.name_rule,
        },
      }),
    onSuccess: () => {
      setEditor(null)
      changed()
    },
    onError: (error) => setError(error.message),
  })
  const toggle = useMutation({
    mutationFn: (value: ModelMetadata) =>
      api('/api/models/?status_only=true', { method: 'PUT', body: { id: value.id, status: value.status === 1 ? 0 : 1 } }),
    onSuccess: changed,
    onError: (error) => toast.error(t(error.message)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/models/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null)
      changed()
    },
    onError: (error) => toast.error(t(error.message)),
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!editor) return
    setError('')
    try {
      if (editor.endpoints?.trim()) JSON.parse(editor.endpoints)
      save.mutate(editor)
    } catch {
      setError('Invalid JSON object')
    }
  }
  const patch = (value: Partial<ModelMetadata>) => setEditor((current) => current && { ...current, ...value })
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Models')}</h1>
          <p>{t('Manage catalog descriptions, visibility and provider metadata.')}</p>
        </div>
        <div className="action-buttons">
          <Button variant="outline" aria-label={t('Refresh')} onClick={() => query.refetch()}>
            <RefreshCw size={14} />
          </Button>
          <Button
            onClick={() => {
              setError('')
              setEditor({ ...blank })
            }}
          >
            <Plus size={14} />
            {t('Add model')}
          </Button>
        </div>
      </div>
      <MetadataNav />
      <AdminSearch
        onSearch={(value) => {
          setPage(1)
          setKeyword(value)
          setState(filter)
        }}
      >
        <FilterSelect
          className="toolbar-filter-select"
          label={t('Visibility')}
          hideLabel
          value={filter}
          onChange={setFilter}
          options={[{ value: '', label: t('All') }, ...Object.entries(visibility).map(([value, label]) => ({ value, label: t(label) }))]}
        />
      </AdminSearch>
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : (
        <>
          <ModelBatchActions
            key={`${bundle?.user.id}:${bundle?.session.sid}`}
            selected={Object.values(selected)}
            onClear={() => setSelected({})}
            onDone={(ids) => setSelected((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(Number(id)))))}
          />
          <p className="small-note">{t('Only saved metadata records can be selected. Channel-only models can be saved through Edit.')}</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={t('Select current page')}
                      checked={
                        query.data.items.some((model) => model.id > 0) &&
                        query.data.items.filter((model) => model.id > 0).every((model) => !!selected[model.id])
                      }
                      onChange={(event) => {
                        const checked = event.target.checked
                        setSelected((previous) => {
                          const next = { ...previous }
                          for (const model of query.data.items)
                            if (model.id > 0) {
                              if (checked) next[model.id] = model
                              else delete next[model.id]
                            }
                          return next
                        })
                      }}
                    />
                  </th>
                  {['Model name', 'Visibility', 'Channels', 'Name matching rule', 'Tags', 'Actions'].map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((model) => (
                  <tr key={model.model_name}>
                    <td>
                      <input
                        type="checkbox"
                        disabled={model.id <= 0}
                        aria-label={`${t('Select')} ${model.model_name}`}
                        checked={!!selected[model.id]}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setSelected((previous) => {
                            const next = { ...previous }
                            if (checked) next[model.id] = model
                            else delete next[model.id]
                            return next
                          })
                        }}
                      />
                    </td>
                    <td>
                      <strong>{model.model_name}</strong>
                      <div className="small-note admin-models">{model.description || '—'}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${model.square_state === 'visible' ? 'success' : ''}`}>
                        {t(visibility[model.square_state as keyof typeof visibility] || 'Unavailable')}
                      </span>
                    </td>
                    <td title={model.bound_channels?.map((channel) => channel.name).join(', ')}>
                      {model.configured_channel_count ?? model.bound_channels?.length ?? 0}
                    </td>
                    <td>{t(rules[model.name_rule])}</td>
                    <td className="small-note">{model.tags || '—'}</td>
                    <td>
                      <div className="action-buttons">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t('Edit')} ${model.model_name}`}
                          onClick={() => {
                            setError('')
                            setEditor({
                              ...blank,
                              ...model,
                              status: model.id > 0 ? model.status : 1,
                              sync_official: model.id > 0 ? model.sync_official : 0,
                            })
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                        {model.id > 0 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={toggle.isPending}
                              aria-label={t(model.status === 1 ? 'Hide' : 'Show')}
                              onClick={() => toggle.mutate(model)}
                            >
                              {model.status === 1 ? <EyeOff size={14} /> : <Eye size={14} />}
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`${t('Delete')} ${model.model_name}`} onClick={() => setDeleting(model)}>
                              <Trash2 size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.items.length && <EmptyState />}
          <AdminPagination page={page} total={query.data.total} onPage={setPage} />
        </>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setEditor(null)
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t(editor?.id ? 'Edit model' : 'Add model')}</DialogTitle>
            <DialogDescription>{t('Manage catalog descriptions, visibility and provider metadata.')}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form onSubmit={submit}>
              <div className="admin-form-grid">
                <label className="field">
                  <span>{t('Model name')}</span>
                  <input required maxLength={128} value={editor.model_name} onChange={(event) => patch({ model_name: event.target.value })} />
                </label>
                <label className="field">
                  <span>{t('Name matching rule')}</span>
                  <select value={editor.name_rule} onChange={(event) => patch({ name_rule: Number(event.target.value) })}>
                    {rules.map((label, index) => (
                      <option key={label} value={index}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field admin-wide">
                  <span>{t('Description')}</span>
                  <textarea rows={3} value={editor.description || ''} onChange={(event) => patch({ description: event.target.value })} />
                </label>
                <label className="field">
                  <span>{t('Vendor')}</span>
                  <select value={editor.vendor_id || 0} onChange={(event) => patch({ vendor_id: Number(event.target.value) })}>
                    <option value={0}>{t('None')}</option>
                    {vendors.data?.items.map((vendor) => (
                      <option value={vendor.id} key={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t('Icon')}</span>
                  <input value={editor.icon || ''} onChange={(event) => patch({ icon: event.target.value })} />
                </label>
                <div className="admin-wide">
                  <PrefillSelect
                    type="tag"
                    onSelect={(tags) =>
                      patch({
                        tags: [
                          ...new Set(
                            `${editor.tags || ''},${tags}`
                              .split(',')
                              .map((value) => value.trim())
                              .filter(Boolean)
                          ),
                        ].join(','),
                      })
                    }
                  />
                </div>
                <label className="field admin-wide">
                  <span>{t('Tags')}</span>
                  <input value={editor.tags || ''} onChange={(event) => patch({ tags: event.target.value })} />
                </label>
                <label className="field admin-wide">
                  <span>{t('Custom endpoints')} · JSON</span>
                  <textarea
                    spellCheck={false}
                    rows={3}
                    value={editor.endpoints || ''}
                    onChange={(event) => patch({ endpoints: event.target.value })}
                  />
                </label>
                <div className="admin-wide">
                  <PrefillSelect type="endpoint" onSelect={(endpoints) => patch({ endpoints })} />
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" checked={editor.status === 1} onChange={(event) => patch({ status: event.target.checked ? 1 : 0 })} />
                  {t('Visible in catalog')}
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editor.sync_official === 1}
                    onChange={(event) => patch({ sync_official: event.target.checked ? 1 : 0 })}
                  />
                  {t('Follow official metadata')}
                </label>
              </div>
              {vendors.error && <ErrorState error={vendors.error} retry={() => vendors.refetch()} />}{' '}
              {error && (
                <p role="alert" className="inline-error">
                  {t(error)}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditor(null)}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {t('Save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {deleting && (
        <AdminConfirm
          title={t('Delete model metadata')}
          description={deleting.model_name}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
