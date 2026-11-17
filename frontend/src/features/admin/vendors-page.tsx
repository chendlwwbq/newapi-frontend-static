'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm, AdminPagination, AdminSearch } from './shared'
import { MetadataNav } from './metadata-nav'
import { VendorOperation, type VendorOperationInput } from './vendor-operation'
import type { VendorMetadata } from './metadata-types'

export function VendorsPage() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const [selected, setSelected] = useState<Record<number, VendorMetadata>>({}),
    [operation, setOperation] = useState<VendorOperationInput | null>(null),
    [association, setAssociation] = useState('')
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [editor, setEditor] = useState<VendorMetadata | null>(null),
    [deleting, setDeleting] = useState<VendorMetadata | null>(null),
    [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['admin-vendors', bundle?.user.id, page, keyword, association],
    queryFn: ({ signal }) =>
      api<PageResult<VendorMetadata>>(`/api/vendors/search?${new URLSearchParams({ keyword, association, p: String(page), page_size: '20' })}`, {
        signal,
      }),
  })
  function changed() {
    void queries.invalidateQueries({ queryKey: ['admin-vendors'] })
    void queries.invalidateQueries({ queryKey: ['admin-vendor-options'] })
    toast.success(t('Saved'))
  }
  const save = useMutation({
    mutationFn: (value: VendorMetadata) =>
      api('/api/vendors/', {
        method: value.id ? 'PUT' : 'POST',
        body: {
          id: value.id || undefined,
          name: value.name,
          description: value.description,
          icon: value.icon,
          status: value.status,
          version: value.version,
        },
      }),
    onSuccess: () => {
      setEditor(null)
      changed()
    },
    onError: (error) => setError(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/vendors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null)
      changed()
    },
    onError: (error) => toast.error(t(error.message)),
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (editor) save.mutate(editor)
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Vendors')}</h1>
          <p>{t('Maintain provider names, descriptions and icons.')}</p>
        </div>
        <Button
          onClick={() => {
            setError('')
            setEditor({ id: 0, name: '', description: '', icon: '', status: 1 })
          }}
        >
          <Plus size={14} />
          {t('Add vendor')}
        </Button>
      </div>
      <MetadataNav />
      <AdminSearch
        onSearch={(value) => {
          setKeyword(value)
          setPage(1)
        }}
      >
        <select
          className="plain-select"
          aria-label={t('Model association')}
          value={association}
          onChange={(event) => {
            setAssociation(event.target.value)
            setPage(1)
          }}
        >
          <option value="">{t('All')}</option>
          <option value="linked">{t('With linked models')}</option>
          <option value="unlinked">{t('Without linked models')}</option>
        </select>
      </AdminSearch>
      <div className="metadata-batch-toolbar">
        <span>
          {t('Selected records')}: {Object.keys(selected).length}
        </span>
        <Button
          variant="outline"
          disabled={!Object.keys(selected).length}
          onClick={() => setOperation({ action: 'merge', vendor_ids: Object.values(selected).map((vendor) => vendor.id) })}
        >
          {t('Merge vendors')}
        </Button>
        <Button
          variant="outline"
          disabled={!Object.keys(selected).length}
          onClick={() => setOperation({ action: 'delete', vendor_ids: Object.values(selected).map((vendor) => vendor.id) })}
        >
          {t('Delete vendors')}
        </Button>
        <Button variant="ghost" onClick={() => setSelected({})}>
          {t('Clear selection')}
        </Button>
      </div>
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
                  <th>
                    <input
                      type="checkbox"
                      aria-label={t('Select current page')}
                      checked={query.data.items.length > 0 && query.data.items.every((vendor) => !!selected[vendor.id])}
                      onChange={(event) => {
                        const checked = event.target.checked
                        setSelected((previous) => {
                          const next = { ...previous }
                          for (const vendor of query.data.items) {
                            if (checked) next[vendor.id] = vendor
                            else delete next[vendor.id]
                          }
                          return next
                        })
                      }}
                    />
                  </th>
                  {['Name', 'Description', 'Models', 'Status', 'Actions'].map((label) => (
                    <th key={label} className={label === 'Actions' ? 'table-sticky-action' : undefined}>
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${t('Select')} ${vendor.name}`}
                        checked={!!selected[vendor.id]}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setSelected((previous) => {
                            const next = { ...previous }
                            if (checked) next[vendor.id] = vendor
                            else delete next[vendor.id]
                            return next
                          })
                        }}
                      />
                    </td>
                    <td>
                      <strong>{vendor.name}</strong>
                      <div className="small-note">#{vendor.id}</div>
                    </td>
                    <td>
                      <span className="admin-models">{vendor.description || '—'}</span>
                    </td>
                    <td>{vendor.model_count ?? 0}</td>
                    <td>{t(vendor.status === 1 ? 'Enabled' : 'Disabled')}</td>
                    <td className="table-sticky-action">
                      <div className="action-buttons">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t('Edit')} ${vendor.name}`}
                          onClick={() => {
                            setError('')
                            setEditor({ ...vendor })
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`${t('Delete')} ${vendor.name}`} onClick={() => setDeleting(vendor)}>
                          <Trash2 size={14} />
                        </Button>
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
        <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t(editor?.id ? 'Edit vendor' : 'Add vendor')}</DialogTitle>
            <DialogDescription>{t('Maintain provider names, descriptions and icons.')}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto pr-1">
              <label className="field">
                <span>{t('Name')}</span>
                <input required value={editor.name} maxLength={128} onChange={(event) => setEditor({ ...editor, name: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Description')}</span>
                <textarea rows={3} value={editor.description || ''} onChange={(event) => setEditor({ ...editor, description: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Icon')}</span>
                <input value={editor.icon || ''} onChange={(event) => setEditor({ ...editor, icon: event.target.value })} />
              </label>
              {error && (
                <p className="inline-error" role="alert">
                  {t(error)}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditor(null)}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" loading={save.isPending}>
                  {t('Save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {operation && (
        <VendorOperation
          key={`${bundle?.user.id}:${bundle?.session.sid}`}
          input={operation}
          onClose={() => setOperation(null)}
          onSaved={() => {
            setSelected({})
            changed()
          }}
        />
      )}
      {deleting && (
        <AdminConfirm
          title={t('Delete vendor')}
          description={deleting.name}
          busy={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
        />
      )}
    </>
  )
}
