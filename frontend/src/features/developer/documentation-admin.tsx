'use client'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminSearch, AdminPagination, AdminConfirm } from '@/features/admin/shared'
import { ContentPreview } from '@/components/shared/content-preview'
import { DeveloperNav } from './developer-nav'
import type { DeveloperDoc, DocBinding, RegistryList } from './types'

const emptyDoc: DeveloperDoc = {
  id: 0,
  slug: '',
  title: '',
  summary: '',
  source_type: 'markdown',
  markdown_content: '',
  external_url: '',
  language: 'en',
  status: 2,
  bindings: [],
  created_time: 0,
  updated_time: 0,
}
export function DocumentationAdmin() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [status, setStatus] = useState(''),
    [editor, setEditor] = useState<DeveloperDoc | null>(null),
    [deleting, setDeleting] = useState<DeveloperDoc | null>(null),
    [bindingDoc, setBindingDoc] = useState<DeveloperDoc | null>(null),
    [error, setError] = useState('')
  const [binding, setBinding] = useState<Pick<DocBinding, 'target_type' | 'target_key' | 'is_primary' | 'sort_order'>>({
    target_type: 'model',
    target_key: '',
    is_primary: false,
    sort_order: 0,
  })
  const list = useQuery({
    queryKey: ['developer-admin', bundle?.user.id, page, keyword, status],
    enabled: bundle?.user.role === 100,
    queryFn: ({ signal }) =>
      api<RegistryList<DeveloperDoc>>(`/api/developer-docs/admin?${new URLSearchParams({ p: String(page), page_size: '20', keyword, status })}`, {
        signal,
      }),
  })
  const headers = { 'If-Match': String(list.data?.version ?? 0) }
  async function changed() {
    await Promise.all([
      queries.invalidateQueries({ queryKey: ['developer-admin'] }),
      queries.invalidateQueries({ queryKey: ['developer-published'] }),
      queries.invalidateQueries({ queryKey: ['rest-published'] }),
      queries.invalidateQueries({ queryKey: ['rest-admin'] }),
    ])
    setEditor(null)
    setDeleting(null)
    setBindingDoc(null)
    setError('')
    toast.success(t('Saved'))
  }
  const save = useMutation({
    mutationFn: (doc: DeveloperDoc) =>
      api(`/api/developer-docs/admin${doc.id ? '/' + doc.id : ''}`, { method: doc.id ? 'PUT' : 'POST', body: doc, headers }),
    onSuccess: changed,
    onError: (failure: Error) => setError(failure.message),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/developer-docs/admin/${id}`, { method: 'DELETE', headers }),
    onSuccess: changed,
    onError: (failure: Error) => toast.error(t(failure.message)),
  })
  const publish = useMutation({
    mutationFn: (doc: DeveloperDoc) =>
      api(`/api/developer-docs/admin/${doc.id}/status`, { method: 'PATCH', body: { status: doc.status === 1 ? 2 : 1 }, headers }),
    onSuccess: changed,
    onError: (failure: Error) => toast.error(t(failure.message)),
  })
  const bind = useMutation({
    mutationFn: ({ doc, method, value }: { doc: DeveloperDoc; method: string; value: typeof binding }) =>
      api(`/api/developer-docs/admin/${doc.id}/bindings`, { method, body: value, headers }),
    onSuccess: changed,
    onError: (failure: Error) => setError(failure.message),
  })
  if (bundle?.user.role !== 100) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  function submit(event: FormEvent) {
    event.preventDefault()
    if (editor) save.mutate(editor)
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Developer documentation')}</h1>
          <p>{t('Publish Markdown or external documentation and bind it to models and REST operations.')}</p>
        </div>
        <Button
          onClick={() => {
            setEditor({ ...emptyDoc })
            setError('')
          }}
        >
          <Plus size={14} />
          {t('Add documentation')}
        </Button>
      </div>
      <DeveloperNav />
      <AdminSearch
        onSearch={(value) => {
          setKeyword(value)
          setPage(1)
        }}
      >
        <label className="field">
          <span>{t('Status')}</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          >
            <option value="">{t('All')}</option>
            <option value="1">{t('Published')}</option>
            <option value="2">{t('Disabled')}</option>
          </select>
        </label>
      </AdminSearch>
      {list.error ? (
        <ErrorState error={list.error} retry={() => list.refetch()} />
      ) : list.isPending ? (
        <LoadingState />
      ) : !list.data.items.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Title', 'Language', 'Type', 'Status', 'Bindings', 'Actions'].map((label) => (
                    <th key={label} className={label === 'Actions' ? 'table-sticky-action' : undefined}>
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <strong>{doc.title}</strong>
                      <div className="small-note">{doc.slug}</div>
                    </td>
                    <td>{doc.language}</td>
                    <td>{t(doc.source_type === 'markdown' ? 'Markdown' : 'External link')}</td>
                    <td>
                      <span className={`status-badge ${doc.status === 1 ? 'success' : ''}`}>{t(doc.status === 1 ? 'Published' : 'Disabled')}</span>
                    </td>
                    <td>{doc.bindings?.length || 0}</td>
                    <td className="table-sticky-action">
                      <div className="action-buttons">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t('Edit')} ${doc.title}`}
                          onClick={() => {
                            setEditor({ ...doc })
                            setError('')
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t('Bindings')} ${doc.title}`}
                          onClick={() => {
                            setBindingDoc(doc)
                            setBinding({ target_type: 'model', target_key: '', is_primary: false, sort_order: 0 })
                            setError('')
                          }}
                        >
                          <Link2 size={14} />
                        </Button>
                        <Button variant="outline" disabled={publish.isPending} onClick={() => publish.mutate(doc)}>
                          {t(doc.status === 1 ? 'Disable' : 'Publish')}
                        </Button>
                        {doc.status === 1 && (
                          <Link className="text-link" href={`/docs/published/${encodeURIComponent(doc.slug)}`}>
                            {t('View')}
                          </Link>
                        )}
                        <Button variant="ghost" size="icon" aria-label={`${t('Delete')} ${doc.title}`} onClick={() => setDeleting(doc)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination page={page} total={list.data.total} onPage={setPage} />
        </>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setEditor(null)
        }}
      >
        <DialogContent className="admin-editor developer-doc-editor flex max-h-[88vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t(editor?.id ? 'Edit documentation' : 'Add documentation')}</DialogTitle>
            <DialogDescription>{t('Publish Markdown or external documentation and bind it to models and REST operations.')}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="admin-form-grid">
                <label className="field">
                  <span>{t('Slug')}</span>
                  <Input
                    required
                    pattern="[a-z0-9][a-z0-9-]{0,95}"
                    maxLength={96}
                    value={editor.slug}
                    onChange={(event) => setEditor({ ...editor, slug: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>{t('Title')}</span>
                  <Input required maxLength={160} value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} />
                </label>
              </div>
              <label className="field">
                <span>{t('Summary')}</span>
                <Textarea
                  rows={2}
                  maxLength={500}
                  value={editor.summary}
                  onChange={(event) => setEditor({ ...editor, summary: event.target.value })}
                />
              </label>
              <div className="admin-form-grid">
                <label className="field">
                  <span>{t('Language')}</span>
                  <select value={editor.language} onChange={(event) => setEditor({ ...editor, language: event.target.value })}>
                    {['en', 'zh', 'zh-TW', 'fr', 'ja', 'ru', 'vi'].map((language) => (
                      <option key={language}>{language}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t('Source type')}</span>
                  <select
                    value={editor.source_type}
                    onChange={(event) => setEditor({ ...editor, source_type: event.target.value as DeveloperDoc['source_type'] })}
                  >
                    <option value="markdown">Markdown</option>
                    <option value="external">{t('External link')}</option>
                  </select>
                </label>
              </div>
              {editor.source_type === 'markdown' ? (
                <div className="developer-markdown-workspace">
                  <label className="field">
                    <span>Markdown</span>
                    <Textarea
                      rows={18}
                      required
                      maxLength={100000}
                      value={editor.markdown_content}
                      onChange={(event) => setEditor({ ...editor, markdown_content: event.target.value })}
                    />
                  </label>
                  <ContentPreview source={editor.markdown_content} />
                </div>
              ) : (
                <label className="field">
                  <span>{t('External URL')}</span>
                  <Input
                    type="url"
                    required
                    value={editor.external_url}
                    onChange={(event) => setEditor({ ...editor, external_url: event.target.value })}
                  />
                </label>
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editor.status === 1}
                  onChange={(event) => setEditor({ ...editor, status: event.target.checked ? 1 : 2 })}
                />
                {t('Published')}
              </label>
              {error && (
                <p role="alert" className="inline-error">
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
      <Dialog
        open={!!bindingDoc}
        onOpenChange={(open) => {
          if (!open && !bind.isPending) setBindingDoc(null)
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Documentation bindings')}</DialogTitle>
            <DialogDescription>{bindingDoc?.title}</DialogDescription>
          </DialogHeader>
          {bindingDoc && (
            <>
              <div className="developer-binding-list">
                {bindingDoc.bindings?.map((item) => (
                  <div className="developer-binding" key={item.id}>
                    <code>
                      {item.target_type}: {item.target_key}
                    </code>
                    <span>
                      {item.is_primary ? t('Primary') : ''} · {item.sort_order}
                    </span>
                    <Button variant="ghost" disabled={bind.isPending} onClick={() => bind.mutate({ doc: bindingDoc, method: 'DELETE', value: item })}>
                      {t('Remove')}
                    </Button>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  bind.mutate({ doc: bindingDoc, method: 'POST', value: binding })
                }}
              >
                <label className="field">
                  <span>{t('Target type')}</span>
                  <select
                    value={binding.target_type}
                    onChange={(event) => setBinding({ ...binding, target_type: event.target.value as DocBinding['target_type'] })}
                  >
                    <option value="model">{t('Model')}</option>
                    <option value="rest_api">REST API</option>
                    <option value="rest_operation">{t('REST operation')}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('Target identifier')}</span>
                  <Input
                    required
                    maxLength={255}
                    value={binding.target_key}
                    onChange={(event) => setBinding({ ...binding, target_key: event.target.value })}
                  />
                  <small>{t('Use the exact model ID, REST API ID or operation ID shown in the admin list.')}</small>
                </label>
                <label className="field">
                  <span>{t('Sort order')}</span>
                  <Input
                    type="number"
                    min={-10000}
                    max={10000}
                    value={binding.sort_order}
                    onChange={(event) => setBinding({ ...binding, sort_order: Number(event.target.value) })}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={binding.is_primary}
                    onChange={(event) => setBinding({ ...binding, is_primary: event.target.checked })}
                  />
                  {t('Primary')}
                </label>
                {error && (
                  <p role="alert" className="inline-error">
                    {t(error)}
                  </p>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" disabled={bind.isPending} onClick={() => setBindingDoc(null)}>
                    {t('Close')}
                  </Button>
                  <Button type="submit" disabled={bind.isPending}>
                    {t('Bind documentation')}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
      {deleting && (
        <AdminConfirm
          title={t('Delete documentation')}
          description={deleting.title}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
