'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Eye, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api, apiResponse } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm, AdminPagination } from './shared'
import { OpsNav } from './ops-nav'
import type { SystemTask } from './ops-types'

const types = {
  log_cleanup: 'Log cleanup',
  channel_test: 'Channel test',
  model_update: 'Model update',
  midjourney_poll: 'Midjourney polling',
  async_task_poll: 'Async task polling',
}
const statuses = { pending: 'Pending', running: 'Running', succeeded: 'Succeeded', failed: 'Failed' }
export function OpsTasks() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    root = bundle?.user.role === 100
  const [page, setPage] = useState(1),
    [type, setType] = useState(''),
    [status, setStatus] = useState(''),
    [scope, setScope] = useState('')
  const [detailId, setDetailId] = useState(''),
    [clearing, setClearing] = useState(false)
  const params = new URLSearchParams({ type, status, scope, limit: '20', offset: String((page - 1) * 20) })
  const query = useQuery({
    queryKey: ['system-tasks', bundle?.user.id, type, status, scope, page],
    enabled: root,
    queryFn: async ({ signal }) => {
      const result = await apiResponse<SystemTask[]>(`/api/system-task/list?${params}`, { signal })
      return { items: result.data, total: (result as typeof result & { total: number }).total }
    },
    refetchInterval: (value) => (value.state.data?.items.some((task) => ['pending', 'running'].includes(task.status)) ? 10_000 : false),
  })
  const detail = useQuery({
    queryKey: ['system-task', bundle?.user.id, detailId],
    enabled: root && !!detailId,
    queryFn: ({ signal }) => api<SystemTask>(`/api/system-task/${encodeURIComponent(detailId)}`, { signal }),
    refetchInterval: (query) => (query.state.data && ['pending', 'running'].includes(query.state.data.status) ? 3000 : false),
  })
  const clear = useMutation({
    mutationFn: () => api<{ deleted_count: number }>(`/api/system-task/history?${new URLSearchParams({ type, status })}`, { method: 'DELETE' }),
    onSuccess: () => {
      setClearing(false)
      setPage(1)
      void queries.invalidateQueries({ queryKey: ['system-tasks'] })
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const date = (value: number) => new Date(value * 1000).toLocaleString(toIntlLocale(i18n.language), { hour12: false })
  if (!root) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('System tasks')}</h1>
          <p>{t('Track scheduled jobs, active work and completed task results.')}</p>
        </div>
        <div className="action-buttons">
          <Button variant="outline" onClick={() => setClearing(true)}>
            {t('Clear task history')}
          </Button>
          <Button variant="outline" aria-label={t('Refresh')} onClick={() => query.refetch()}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>
      <OpsNav />
      <div className="console-toolbar admin-toolbar">
        <select
          className="plain-select"
          aria-label={t('Type')}
          value={type}
          onChange={(event) => {
            setType(event.target.value)
            setPage(1)
          }}
        >
          <option value="">{t('All types')}</option>
          {Object.entries(types).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
        <select
          className="plain-select"
          aria-label={t('Status')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="">{t('All statuses')}</option>
          {Object.entries(statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
        <select
          className="plain-select"
          aria-label={t('Scope')}
          value={scope}
          onChange={(event) => {
            setScope(event.target.value)
            setPage(1)
          }}
        >
          <option value="">{t('All')}</option>
          <option value="active">{t('Active')}</option>
          <option value="history">{t('History')}</option>
        </select>
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
                  {['Task ID', 'Type', 'Status', 'Worker', 'Updated', 'Details'].map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((task) => (
                  <tr key={task.task_id}>
                    <td>
                      <code className="admin-models" title={task.task_id}>
                        {task.task_id}
                      </code>
                    </td>
                    <td>{t(types[task.type as keyof typeof types] || task.type)}</td>
                    <td>
                      <span className={`status-badge ${task.status === 'succeeded' ? 'success' : ''}`}>
                        {t(statuses[task.status as keyof typeof statuses] || task.status)}
                      </span>
                    </td>
                    <td>{task.locked_by || '—'}</td>
                    <td className="small-note">{date(task.updated_at)}</td>
                    <td>
                      <Button variant="ghost" size="icon" aria-label={`${t('Details')} ${task.task_id}`} onClick={() => setDetailId(task.task_id)}>
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
        open={!!detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId('')
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Task details')}</DialogTitle>
            <DialogDescription>{detailId}</DialogDescription>
          </DialogHeader>
          {detail.error ? (
            <ErrorState error={detail.error} retry={() => detail.refetch()} />
          ) : detail.isPending ? (
            <LoadingState />
          ) : (
            <>
              <p className="small-note">
                {t(statuses[detail.data.status as keyof typeof statuses] || detail.data.status)} · {date(detail.data.updated_at)}
              </p>
              {detail.data.error && <p className="inline-error">{t(detail.data.error)}</p>}
              {(['payload', 'state', 'result'] as const).map((key) => (
                <section className="admin-advanced" key={key}>
                  <h3>{t({ payload: 'Parameters', state: 'Progress', result: 'Result' }[key])}</h3>
                  <pre className="admin-pricing-effective">{JSON.stringify(detail.data[key], null, 2)}</pre>
                </section>
              ))}
            </>
          )}
        </DialogContent>
      </Dialog>
      {clearing && (
        <AdminConfirm
          title={t('Clear task history')}
          description={t(
            'Remove completed history matching the type and status filters. Active tasks and the latest record of each type are preserved.'
          )}
          busy={clear.isPending}
          onConfirm={() => clear.mutate()}
          onClose={() => setClearing(false)}
        />
      )}
    </>
  )
}
