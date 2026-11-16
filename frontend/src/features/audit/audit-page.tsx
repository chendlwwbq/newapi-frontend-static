'use client'
import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, Eye, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult } from '@/lib/api/types'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminPagination } from '@/features/admin/shared'

type AuditRecord = {
  event_id: string
  user_id: number
  username: string
  actor_role: number
  created_at: number
  category: string
  action: string
  token_ref: string
  auth_method?: string
  ip: string
  user_agent: string
  method: string
  route: string
  status: number
  success: boolean
  request_id: string
  content: string
  other: Record<string, unknown> | null
}
const categories = { login: 'Login', security: 'Security', operation: 'Operation', access_token: 'Access token' }
const initial = { category: '', success: '', username: '', request_id: '', token_ref: '', start: '', end: '' }
export function AuditPage() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth()
  const canReadAll = bundle?.user.role === 100 || (bundle?.user.role === 10 && bundle.user.permissions?.admin_permissions?.audit?.read === true)
  const [scope, setScope] = useState('self'),
    [page, setPage] = useState(1),
    [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial),
    [detail, setDetail] = useState<AuditRecord | null>(null)
  const query = useQuery({
    queryKey: ['audit', bundle?.user.id, scope, filters, page],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ p: String(page), page_size: '20' })
      for (const key of ['category', 'success', 'request_id', 'token_ref'] as const) if (filters[key]) params.set(key, filters[key])
      if (scope === 'all' && filters.username) params.set('username', filters.username)
      if (filters.start) params.set('start_timestamp', String(Math.floor(new Date(filters.start).getTime() / 1000)))
      if (filters.end) params.set('end_timestamp', String(Math.floor(new Date(filters.end).getTime() / 1000)))
      return api<PageResult<AuditRecord>>(`/api/audit${scope === 'self' ? '/self' : ''}?${params}`, { signal })
    },
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setFilters({ ...draft, username: draft.username.trim(), request_id: draft.request_id.trim(), token_ref: draft.token_ref.trim() })
  }
  function exportPage() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(query.data?.items || [], null, 2)], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `eva-audit-${scope}-page-${page}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const date = (value: number) => new Date(value * 1000).toLocaleString(toIntlLocale(i18n.language), { hour12: false })
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Audit logs')}</h1>
          <p>{t('Review account security events and management actions.')}</p>
        </div>
        <div className="action-buttons">
          <Button variant="outline" aria-label={t('Refresh')} onClick={() => query.refetch()}>
            <RefreshCw size={14} />
          </Button>
          <Button variant="outline" disabled={!query.data?.items.length} onClick={exportPage}>
            <Download size={14} />
            {t('Export current page')}
          </Button>
        </div>
      </div>
      <form className="audit-filters" onSubmit={submit}>
        <div className="field">
          <FilterSelect
            className="logs-filter-select"
            label={t('Scope')}
            value={scope}
            onChange={(value) => {
              setScope(value)
              setPage(1)
              setDetail(null)
            }}
            options={[{ value: 'self', label: t('My audit records') }, ...(canReadAll ? [{ value: 'all', label: t('All audit records') }] : [])]}
          />
        </div>
        <div className="field">
          <FilterSelect
            className="logs-filter-select"
            label={t('Category')}
            value={draft.category}
            onChange={(value) => setDraft({ ...draft, category: value })}
            options={[{ value: '', label: t('All') }, ...Object.entries(categories).map(([value, label]) => ({ value, label: t(label) }))]}
          />
        </div>
        <div className="field">
          <FilterSelect
            className="logs-filter-select"
            label={t('Result')}
            value={draft.success}
            onChange={(value) => setDraft({ ...draft, success: value })}
            options={[
              { value: '', label: t('All') },
              { value: 'true', label: t('Success') },
              { value: 'false', label: t('Failed') },
            ]}
          />
        </div>
        {scope === 'all' && (
          <label className="field">
            <span>{t('Username')}</span>
            <input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
          </label>
        )}
        <label className="field">
          <span>{t('Request ID')}</span>
          <input value={draft.request_id} onChange={(event) => setDraft({ ...draft, request_id: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('Token fingerprint')}</span>
          <input pattern="[a-f0-9]{64}" value={draft.token_ref} onChange={(event) => setDraft({ ...draft, token_ref: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('Start time')}</span>
          <input
            type="datetime-local"
            max={draft.end || undefined}
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
          />
        </label>
        <label className="field">
          <span>{t('End time')}</span>
          <input
            type="datetime-local"
            min={draft.start || undefined}
            value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value })}
          />
        </label>
        <div className="action-buttons">
          <Button type="submit">{t('Search')}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(initial)
              setFilters(initial)
              setPage(1)
            }}
          >
            {t('Reset')}
          </Button>
        </div>
      </form>
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
                  {['Time', 'User', 'Category', 'Action', 'Request', 'Result', 'Details'].map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((record) => (
                  <tr key={record.event_id}>
                    <td className="small-note tabular-nums font-mono">{date(record.created_at)}</td>
                    <td>{record.username || `#${record.user_id}`}</td>
                    <td>{t(categories[record.category as keyof typeof categories] || record.category)}</td>
                    <td>
                      <code className="admin-models" title={record.action}>
                        {record.action || '—'}
                      </code>
                    </td>
                    <td>
                      <span className="admin-models" title={`${record.method} ${record.route}`}>
                        {record.method} {record.route}
                      </span>
                      <span className="small-note tabular-nums font-mono">{record.status || '—'}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${record.success ? 'success' : ''}`}>{t(record.success ? 'Success' : 'Failed')}</span>
                    </td>
                    <td>
                      <Button variant="ghost" size="icon" aria-label={`${t('Details')} ${record.event_id}`} onClick={() => setDetail(record)}>
                        <Eye size={14} />
                      </Button>
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
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Audit details')}</DialogTitle>
            <DialogDescription>{detail?.action || detail?.event_id}</DialogDescription>
          </DialogHeader>
          {detail && (
            <>
              <dl className="ops-details">
                {[
                  ['Event ID', detail.event_id],
                  ['Request ID', detail.request_id],
                  ['User', `${detail.username} (#${detail.user_id})`],
                  ['Role', detail.actor_role],
                  ['Time', date(detail.created_at)],
                  ['Request', `${detail.method} ${detail.route}`],
                  ['IP address', detail.ip],
                  ['User agent', detail.user_agent],
                  ['Authentication method', detail.auth_method],
                  ['Token fingerprint', detail.token_ref],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{t(String(label))}</dt>
                    <dd>
                      {value || '—'}
                      {label === 'Request ID' && !!value && <CopyButton value={String(value)} />}
                    </dd>
                  </div>
                ))}
              </dl>
              {detail.content && <p className="small-note">{t(detail.content)}</p>}
              <pre className="admin-pricing-effective">{JSON.stringify(detail.other, null, 2)}</pre>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
