'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminSearch, AdminPagination, AdminConfirm } from '@/features/admin/shared'
import { DeveloperNav } from './developer-nav'
import { RestUpstreamsAdmin, RestRelayButton } from './rest-relay-admin'
import { useQuotaFormatter } from '@/lib/format'
import type { RestDefinition, RestOperation, RegistryList } from './types'

const emptyAPI: RestDefinition = {
  id: 0,
  slug: '',
  name: '',
  description: '',
  group: 'default',
  icon: '',
  tags: [],
  status: 2,
  operations: [],
  created_time: 0,
  updated_time: 0,
}
export function RestDefinitionsAdmin() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    formatQuota = useQuotaFormatter()
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [status, setStatus] = useState(''),
    [editor, setEditor] = useState<RestDefinition | null>(null),
    [deleting, setDeleting] = useState<RestDefinition | null>(null),
    [detailID, setDetailID] = useState(0),
    [importAPI, setImportAPI] = useState<RestDefinition | null>(null),
    [document, setDocument] = useState(''),
    [operation, setOperation] = useState<RestOperation | null>(null),
    [error, setError] = useState('')
  const list = useQuery({
    queryKey: ['rest-admin', 'list', bundle?.user.id, page, keyword, status],
    enabled: bundle?.user.role === 100,
    queryFn: ({ signal }) =>
      api<RegistryList<RestDefinition>>(`/api/rest-api/admin/?${new URLSearchParams({ p: String(page), page_size: '20', keyword, status })}`, {
        signal,
      }),
  })
  const detail = useQuery({
    queryKey: ['rest-admin', 'detail', bundle?.user.id, detailID],
    enabled: bundle?.user.role === 100 && !!detailID,
    queryFn: ({ signal }) => api<RestDefinition>(`/api/rest-api/admin/${detailID}`, { signal }),
  })
  const mutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api(path, { method, body, headers: { 'If-Match': String(list.data?.version ?? 0) } }),
    onSuccess: async () => {
      await Promise.all([
        queries.invalidateQueries({ queryKey: ['rest-admin'] }),
        queries.invalidateQueries({ queryKey: ['rest-published'] }),
        queries.invalidateQueries({ queryKey: ['developer-admin'] }),
        queries.invalidateQueries({ queryKey: ['developer-published'] }),
      ])
      setEditor(null)
      setDeleting(null)
      setImportAPI(null)
      setOperation(null)
      setError('')
      toast.success(t('Saved'))
    },
    onError: (failure: Error) => {
      setError(failure.message)
      toast.error(t(failure.message))
    },
  })
  if (bundle?.user.role !== 100) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  function submit(event: FormEvent) {
    event.preventDefault()
    if (editor) mutation.mutate({ path: `/api/rest-api/admin/${editor.id || ''}`, method: editor.id ? 'PUT' : 'POST', body: editor })
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('REST API definitions')}</h1>
          <p>{t('Manage endpoint definitions and their documentation.')}</p>
        </div>
        <Button
          onClick={() => {
            setEditor({ ...emptyAPI })
            setError('')
          }}
        >
          <Plus size={14} />
          {t('Add API')}
        </Button>
      </div>
      <DeveloperNav />
      <div className="console-toolbar">
        <RestUpstreamsAdmin />
      </div>
      <p className="small-note developer-stage-note">{t('Configure an upstream and an operation price before calling the REST gateway.')}</p>
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
                  {['ID', 'Name', 'Group', 'REST operations', 'Status', 'Actions'].map((label) => (
                    <th key={label} className={label === 'Actions' ? 'table-sticky-action' : undefined}>
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>
                      <strong>{item.name}</strong>
                      <div className="small-note">{item.slug}</div>
                    </td>
                    <td>{item.group}</td>
                    <td>{item.operations.length}</td>
                    <td>
                      <span className={`status-badge ${item.status === 1 ? 'success' : ''}`}>{t(item.status === 1 ? 'Published' : 'Disabled')}</span>
                    </td>
                    <td className="table-sticky-action">
                      <div className="action-buttons">
                        <RestRelayButton apiID={item.id} name={item.name} />
                        <Button variant="outline" onClick={() => setDetailID(item.id)}>
                          {t('REST operations')}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setImportAPI(item)
                            setDocument('')
                            setError('')
                          }}
                        >
                          {t('Import OpenAPI')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t('Edit')} ${item.name}`}
                          onClick={() => {
                            setEditor({ ...item })
                            setError('')
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              path: `/api/rest-api/admin/${item.id}/status`,
                              method: 'PATCH',
                              body: { status: item.status === 1 ? 2 : 1 },
                            })
                          }
                        >
                          {t(item.status === 1 ? 'Disable' : 'Publish')}
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`${t('Delete')} ${item.name}`} onClick={() => setDeleting(item)}>
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
          if (!open && !mutation.isPending) setEditor(null)
        }}
      >
        <DialogContent className="admin-editor flex max-h-[88vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t(editor?.id ? 'Edit API' : 'Add API')}</DialogTitle>
            <DialogDescription>{t('Manage endpoint definitions and their documentation.')}</DialogDescription>
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
                  <span>{t('Name')}</span>
                  <Input required maxLength={160} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} />
                </label>
              </div>
              <label className="field">
                <span>{t('Description')}</span>
                <Textarea
                  rows={4}
                  maxLength={5000}
                  value={editor.description}
                  onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                />
              </label>
              <div className="admin-form-grid">
                <label className="field">
                  <span>{t('Group')}</span>
                  <Input required maxLength={64} value={editor.group} onChange={(event) => setEditor({ ...editor, group: event.target.value })} />
                </label>
                <label className="field">
                  <span>{t('Tags')}</span>
                  <Input
                    value={editor.tags.join(', ')}
                    onChange={(event) => setEditor({ ...editor, tags: event.target.value.split(',').map((tag) => tag.trim()) })}
                  />
                </label>
              </div>
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
                <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setEditor(null)}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" loading={mutation.isPending}>
                  {t('Save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!importAPI}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setImportAPI(null)
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Import OpenAPI')}</DialogTitle>
            <DialogDescription>
              {t('Paste OpenAPI 3 or Swagger 2 in JSON or YAML. Matching methods and paths keep their IDs and enabled state.')}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (importAPI) mutation.mutate({ path: `/api/rest-api/admin/${importAPI.id}/import`, method: 'POST', body: { document } })
            }}
          >
            <label className="field">
              <span>OpenAPI</span>
              <Textarea required rows={17} value={document} onChange={(event) => setDocument(event.target.value)} spellCheck={false} />
            </label>
            {error && (
              <p role="alert" className="inline-error">
                {t(error)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setImportAPI(null)}>
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {t('Import')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detailID}
        onOpenChange={(open) => {
          if (!open) setDetailID(0)
        }}
      >
        <DialogContent className="admin-editor developer-operations-dialog">
          <DialogHeader>
            <DialogTitle>{detail.data?.name || t('REST operations')}</DialogTitle>
            <DialogDescription>{t('Operation IDs can be used for documentation bindings.')}</DialogDescription>
          </DialogHeader>
          {detail.error ? (
            <ErrorState error={detail.error} retry={() => detail.refetch()} />
          ) : detail.isPending ? (
            <LoadingState />
          ) : !detail.data.operations.length ? (
            <EmptyState />
          ) : (
            <div className="developer-operations-list">
              {detail.data.operations.map((op) => (
                <section className="developer-operation" key={op.id}>
                  <div>
                    <code>
                      {op.method} {op.path}
                    </code>
                    <span className="small-note">ID {op.id}</span>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOperation({ ...op })
                        setError('')
                      }}
                    >
                      {t('Edit')}
                    </Button>
                  </div>
                  <h3>{op.summary || op.operation_id}</h3>
                  <p className="small-note">
                    {t(op.enabled ? 'Enabled' : 'Disabled')} · {op.operation_id} ·{' '}
                    {op.quota == null ? t('Pricing not configured') : formatQuota(op.quota, { digitsSmall: 6, digitsLarge: 6 })}
                  </p>
                  <details>
                    <summary>{t('OpenAPI definition')}</summary>
                    <CopyButton value={JSON.stringify(op.definition, null, 2)} />
                    <pre>{JSON.stringify(op.definition, null, 2)}</pre>
                  </details>
                </section>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!operation}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setOperation(null)
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Edit operation')}</DialogTitle>
            <DialogDescription>
              {operation?.method} {operation?.path}
            </DialogDescription>
          </DialogHeader>
          {operation && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                mutation.mutate({ path: `/api/rest-api/admin/${operation.rest_api_id}/operations/${operation.id}`, method: 'PUT', body: operation })
              }}
            >
              <label className="field">
                <span>{t('Operation ID')}</span>
                <Input
                  required
                  maxLength={255}
                  value={operation.operation_id}
                  onChange={(event) => setOperation({ ...operation, operation_id: event.target.value })}
                />
              </label>
              <label className="field">
                <span>{t('Summary')}</span>
                <Input maxLength={500} value={operation.summary} onChange={(event) => setOperation({ ...operation, summary: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Description')}</span>
                <Textarea
                  rows={4}
                  maxLength={10000}
                  value={operation.description}
                  onChange={(event) => setOperation({ ...operation, description: event.target.value })}
                />
              </label>
              <label className="field">
                <span>{t('Fixed price (quota units)')}</span>
                <Input
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  value={operation.quota ?? ''}
                  onChange={(event) => setOperation({ ...operation, quota: event.target.value === '' ? null : Number(event.target.value) })}
                />
                <span className="small-note">
                  {operation.quota == null ? t('Pricing not configured') : formatQuota(operation.quota, { digitsSmall: 6, digitsLarge: 6 })} ·{' '}
                  {t('Zero is free. Native billing group multipliers apply.')}
                </span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={operation.enabled}
                  onChange={(event) => setOperation({ ...operation, enabled: event.target.checked })}
                />
                {t('Enabled')}
              </label>
              {error && (
                <p role="alert" className="inline-error">
                  {t(error)}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" type="button" disabled={mutation.isPending} onClick={() => setOperation(null)}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" loading={mutation.isPending}>
                  {t('Save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {deleting && (
        <AdminConfirm
          title={t('Delete API')}
          description={deleting.name}
          busy={mutation.isPending}
          onConfirm={() => mutation.mutate({ path: `/api/rest-api/admin/${deleting.id}`, method: 'DELETE' })}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
