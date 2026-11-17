'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm } from './shared'
import { MetadataNav } from './metadata-nav'
import { PrefillTransfer } from './prefill-transfer'
import { useAuth } from '@/lib/auth/session'

export type PrefillGroup = {
  id: number
  name: string
  type: 'model' | 'tag' | 'endpoint'
  items: string | string[] | Record<string, unknown>
  description?: string
}
const types = { model: 'Models', tag: 'Tags', endpoint: 'Endpoints' }
export function PrefillGroupsPage() {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    { bundle } = useAuth()
  const [filter, setFilter] = useState(''),
    [editor, setEditor] = useState<PrefillGroup | null>(null),
    [items, setItems] = useState(''),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState<PrefillGroup | null>(null)
  const query = useQuery({
    queryKey: ['prefill-groups', bundle?.user.id],
    queryFn: ({ signal }) => api<PrefillGroup[]>('/api/prefill_group', { signal }),
  })
  function changed() {
    void queries.invalidateQueries({ queryKey: ['prefill-groups'] })
    toast.success(t('Saved'))
  }
  const save = useMutation({
    mutationFn: (value: PrefillGroup) =>
      api('/api/prefill_group', { method: value.id ? 'PUT' : 'POST', body: { ...value, id: value.id || undefined } }),
    onSuccess: () => {
      setEditor(null)
      changed()
    },
    onError: (error) => setError(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/prefill_group/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null)
      changed()
    },
    onError: (error) => toast.error(t(error.message)),
  })
  function edit(group: PrefillGroup) {
    setEditor(group)
    setError('')
    setItems(typeof group.items === 'string' ? group.items : JSON.stringify(group.items, null, 2))
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!editor) return
    setError('')
    try {
      let parsed: PrefillGroup['items']
      if (editor.type === 'endpoint') {
        parsed = JSON.parse(items)
        if (!parsed || typeof parsed !== 'object') throw new Error()
      } else {
        const input: unknown = items.trim().startsWith('[')
          ? JSON.parse(items)
          : items
              .split(/[\n,]/)
              .map((value) => value.trim())
              .filter(Boolean)
        if (!Array.isArray(input) || !input.every((value) => typeof value === 'string')) throw new Error()
        parsed = [...new Set(input.map((value) => value.trim()).filter(Boolean))]
      }
      save.mutate({ ...editor, name: editor.name.trim(), items: parsed })
    } catch {
      setError('Use a string array for models and tags, or a JSON object or array for endpoints.')
    }
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Prefill groups')}</h1>
          <p>{t('Reusable model, tag and endpoint presets.')}</p>
        </div>
        <Button onClick={() => edit({ id: 0, name: '', type: 'model', items: [] })}>
          <Plus size={14} />
          {t('Add group')}
        </Button>
      </div>
      <MetadataNav />
      <div className="console-toolbar">
        <PrefillTransfer
          key={`${bundle?.user.id}:${bundle?.session.sid}`}
          exportGroups={(query.data || []).filter((group) => !filter || group.type === filter)}
        />
        <label className="field">
          <span>{t('Type')}</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">{t('All')}</option>
            {Object.entries(types).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : !query.data.length ? (
        <EmptyState />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {['Name', 'Type', 'Description', 'Items', 'Actions'].map((label) => (
                  <th key={label} className={label === 'Actions' ? 'table-sticky-action' : undefined}>
                    {t(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data
                .filter((group) => !filter || group.type === filter)
                .map((group) => (
                  <tr key={group.id}>
                    <td>
                      <strong>{group.name}</strong>
                    </td>
                    <td>{t(types[group.type] || group.type)}</td>
                    <td>{group.description || '—'}</td>
                    <td>
                      <code className="admin-models">{typeof group.items === 'string' ? group.items : JSON.stringify(group.items)}</code>
                    </td>
                    <td className="table-sticky-action">
                      <div className="action-buttons">
                        <Button variant="ghost" size="icon" aria-label={`${t('Edit')} ${group.name}`} onClick={() => edit({ ...group })}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`${t('Delete')} ${group.name}`} onClick={() => setDeleting(group)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setEditor(null)
        }}
      >
        <DialogContent className="admin-editor flex max-h-[88vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t(editor?.id ? 'Edit group' : 'Add group')}</DialogTitle>
            <DialogDescription>{t('Reusable model, tag and endpoint presets.')}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto pr-1">
              <label className="field">
                <span>{t('Name')}</span>
                <input required maxLength={64} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Type')}</span>
                <select value={editor.type} onChange={(event) => setEditor({ ...editor, type: event.target.value as PrefillGroup['type'] })}>
                  {Object.entries(types).map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('Description')}</span>
                <input
                  maxLength={255}
                  value={editor.description || ''}
                  onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                />
              </label>
              <label className="field">
                <span>{t('Items')}</span>
                <textarea spellCheck={false} rows={8} value={items} onChange={(event) => setItems(event.target.value)} />
                <small>{t('Use a string array for models and tags, or a JSON object or array for endpoints.')}</small>
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
                <Button loading={save.isPending} type="submit">
                  {t('Save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {deleting && (
        <AdminConfirm
          title={t('Delete group')}
          description={deleting.name}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
