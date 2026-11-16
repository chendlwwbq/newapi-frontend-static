'use client'
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power, Trash2, Eye, Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult } from '@/lib/api/types'
import { useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { CopyButton } from '@/components/shared/copy-button'
import { AdminConfirm, AdminSearch, AdminPagination } from './shared'
import type { Redemption } from './types'

interface RedemptionDraft {
  id?: number
  name: string
  quota: string
  count: number
  expires: string
}
export function RedemptionsPage() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    format = useQuotaFormatter()
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [status, setStatus] = useState(''),
    [filter, setFilter] = useState(''),
    [selected, setSelected] = useState<number[]>([])
  const [editor, setEditor] = useState<RedemptionDraft | null>(null),
    [error, setError] = useState(''),
    [generated, setGenerated] = useState<string[] | null>(null),
    [revealed, setRevealed] = useState<Redemption | null>(null)
  const [deleting, setDeleting] = useState<{ path: string; method: string; body?: unknown; label: string } | null>(null)
  const query = useQuery({
    queryKey: ['admin-redemptions', bundle?.user.id, page, keyword, status],
    queryFn: ({ signal }) =>
      api<PageResult<Redemption>>(
        `/api/redemption/search?p=${page}&page_size=20&keyword=${encodeURIComponent(keyword)}&status=${encodeURIComponent(status)}`,
        { signal }
      ),
  })
  const statusQuery = useQuery({ queryKey: ['status'], queryFn: () => api<{ quota_per_unit: number }>('/api/status') }),
    unit = statusQuery.data?.quota_per_unit
  const info = useQuery({
    queryKey: ['topup-info', bundle?.user.id],
    queryFn: () => api<{ payment_compliance_confirmed: boolean }>('/api/user/topup/info'),
  })
  const enabled = info.data?.payment_compliance_confirmed === true
  const items = query.data?.items || [],
    local = toIntlLocale(i18n.language)
  const date = (timestamp: number) => (timestamp ? new Date(timestamp * 1000).toLocaleString(local, { hour12: false }) : '—')
  function changed() {
    void queries.invalidateQueries({ queryKey: ['admin-redemptions'] })
    setSelected([])
  }
  const save = useMutation({
    gcTime: 0,
    mutationFn: (draft: RedemptionDraft) =>
      api<string[] | Redemption>('/api/redemption', {
        method: draft.id ? 'PUT' : 'POST',
        body: {
          id: draft.id,
          name: draft.name,
          quota: Math.round(Number(draft.quota) * unit!),
          count: draft.count,
          expired_time: draft.expires ? Math.floor(new Date(draft.expires).getTime() / 1000) : 0,
        },
      }),
    onSuccess: (data) => {
      if (Array.isArray(data)) setGenerated(data)
      setEditor(null)
      changed()
      toast.success(t('Saved'))
    },
    onError: (error) => {
      setError(error.message)
      if (error instanceof ApiError && Array.isArray(error.data) && error.data.every((value) => typeof value === 'string') && error.data.length) {
        setGenerated(error.data)
        changed()
      }
    },
  })
  const action = useMutation({
    mutationFn: (request: { path: string; method: string; body?: unknown }) => api(request.path, request),
    onSuccess: () => {
      setDeleting(null)
      changed()
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  function edit(item: Redemption) {
    setError('')
    setEditor({
      id: item.id,
      name: item.name,
      quota: unit ? String(item.quota / unit) : '',
      count: 1,
      expires: item.expired_time
        ? new Date(item.expired_time * 1000 - new Date(item.expired_time * 1000).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : '',
    })
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (editor && unit) save.mutate(editor)
  }
  function download(codes: string[]) {
    const url = URL.createObjectURL(new Blob([codes.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'eva-redemption-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Redemption codes')}</h1>
          <p>{t('Create and manage balance redemption codes.')}</p>
        </div>
        <div className="action-buttons">
          <Button variant="outline" aria-label={t('Refresh')} onClick={() => query.refetch()}>
            <RefreshCw size={14} />
          </Button>
          <Button
            disabled={!enabled || !unit}
            onClick={() => {
              setError('')
              setEditor({ name: '', quota: '', count: 1, expires: '' })
            }}
          >
            <Plus size={14} />
            {t('Generate codes')}
          </Button>
        </div>
      </div>
      {info.data && !enabled && (
        <p className="admin-notice">
          {t(
            'Payment, redemption, subscription, and invitation reward features are disabled. The administrator must confirm compliance terms before enabling them.'
          )}
        </p>
      )}
      {info.error && <ErrorState error={info.error} retry={() => info.refetch()} />}
      <AdminSearch
        onSearch={(value) => {
          setKeyword(value)
          setStatus(filter)
          setPage(1)
          setSelected([])
        }}
      >
        <select className="plain-select" aria-label={t('Status')} value={filter} onChange={(event) => setFilter(event.target.value)}>
          {[
            ['', 'All'],
            ['1', 'Enabled'],
            ['2', 'Disabled'],
            ['3', 'Used'],
            ['expired', 'Expired'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDeleting({ path: '/api/redemption/invalid', method: 'DELETE', label: t('Delete invalid redemption codes') })}
        >
          {t('Delete invalid redemption codes')}
        </Button>
      </AdminSearch>
      {!!selected.length && (
        <div className="admin-selection">
          <span>
            {selected.length} {t('Selected')}
          </span>
          <Button variant="outline" onClick={() => download(items.filter((item) => selected.includes(item.id)).map((item) => item.key))}>
            <Download size={14} />
            {t('Export')}
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              setDeleting({ path: '/api/redemption/batch', method: 'POST', body: { ids: selected }, label: `${t('Delete')} · ${selected.length}` })
            }
          >
            {t('Delete')}
          </Button>
        </div>
      )}
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
                      aria-label={t('Select all')}
                      checked={!!items.length && items.every((item) => selected.includes(item.id))}
                      onChange={(event) => setSelected(event.target.checked ? items.map((item) => item.id) : [])}
                    />
                  </th>
                  {['Name', 'Redemption code', 'Status', 'Quota', 'Created', 'Expiry', 'Used by', 'Actions'].map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${t('Select')} ${item.name} ${item.id}`}
                        checked={selected.includes(item.id)}
                        onChange={(event) =>
                          setSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)))
                        }
                      />
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                      <div className="small-note">#{item.id}</div>
                    </td>
                    <td>
                      <code>••••••••</code>
                      <Button variant="ghost" size="icon" aria-label={`${t('View code')} ${item.id}`} onClick={() => setRevealed(item)}>
                        <Eye size={14} />
                      </Button>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${item.status === 1 && (!item.expired_time || item.expired_time > Date.now() / 1000) ? 'success' : ''}`}
                      >
                        {t(
                          item.status === 3
                            ? 'Used'
                            : item.status === 2
                              ? 'Disabled'
                              : item.expired_time && item.expired_time <= Date.now() / 1000
                                ? 'Expired'
                                : 'Enabled'
                        )}
                      </span>
                    </td>
                    <td>{format(item.quota)}</td>
                    <td className="small-note">{date(item.created_time)}</td>
                    <td className="small-note">{item.expired_time ? date(item.expired_time) : t('Never expires')}</td>
                    <td>{item.used_user_id ? `#${item.used_user_id}` : '—'}</td>
                    <td>
                      <div className="action-buttons">
                        {item.status !== 3 && (
                          <>
                            <Button variant="ghost" size="icon" disabled={!unit} aria-label={`${t('Edit')} ${item.id}`} onClick={() => edit(item)}>
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={action.isPending}
                              aria-label={t(item.status === 1 ? 'Disable' : 'Enable')}
                              onClick={() =>
                                action.mutate({
                                  path: '/api/redemption/?status_only=true',
                                  method: 'PUT',
                                  body: { id: item.id, status: item.status === 1 ? 2 : 1 },
                                })
                              }
                            >
                              <Power size={14} />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t('Delete')} ${item.id}`}
                          onClick={() => setDeleting({ path: `/api/redemption/${item.id}`, method: 'DELETE', label: item.name })}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!items.length && <EmptyState />}
          <AdminPagination
            page={page}
            total={query.data.total}
            onPage={(value) => {
              setPage(value)
              setSelected([])
            }}
          />
        </>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setEditor(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(editor?.id ? 'Edit code' : 'Generate codes')}</DialogTitle>
            <DialogDescription>{t('Create and manage balance redemption codes.')}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form onSubmit={submit}>
              <label className="field">
                <span>{t('Name')}</span>
                <input required maxLength={20} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Amount')} (USD)</span>
                <input
                  required
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={editor.quota}
                  onChange={(event) => setEditor({ ...editor, quota: event.target.value })}
                />
              </label>
              {!editor.id && (
                <label className="field">
                  <span>{t('Count')}</span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={editor.count}
                    onChange={(event) => setEditor({ ...editor, count: Number(event.target.value) })}
                  />
                </label>
              )}
              <label className="field">
                <span>{t('Expiry')}</span>
                <input type="datetime-local" value={editor.expires} onChange={(event) => setEditor({ ...editor, expires: event.target.value })} />
                <small className="small-note">{t('Never expires')}</small>
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
                <Button type="submit" disabled={!unit || save.isPending}>
                  {t('Save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!generated || !!revealed}
        onOpenChange={(open) => {
          if (!open) {
            setGenerated(null)
            setRevealed(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{revealed?.name || t('Generated codes')}</DialogTitle>
            <DialogDescription>{t('Store these codes securely. Anyone with a code can redeem its balance.')}</DialogDescription>
          </DialogHeader>
          <div className="code-preview">
            <div>
              <CopyButton value={generated?.join('\n') || revealed?.key || ''} />
              <Button variant="outline" onClick={() => download(generated || [revealed!.key])}>
                <Download size={14} />
                {t('Download')}
              </Button>
            </div>
            <pre className="admin-secret">{generated?.join('\n') || revealed?.key}</pre>
          </div>
        </DialogContent>
      </Dialog>
      {deleting && (
        <AdminConfirm
          title={t('Delete redemption codes')}
          description={deleting.label}
          busy={action.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => action.mutate(deleting)}
        />
      )}
    </>
  )
}
