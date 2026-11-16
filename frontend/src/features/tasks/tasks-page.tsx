'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { PageResult } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter, formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { toIntlLocale } from '@/i18n/languages'
import { initialTaskFilters, taskParams, type TaskFilters } from './lib/task-filters'
import { useTaskFilters } from './lib/use-task-filters'
import { TaskResult } from './task-result'
import { TASK_STATUS } from './constants'
import type { TaskLog } from './types'

const statusLabels: Record<string, string> = {
  NOT_START: 'Not started',
  SUBMITTED: 'Submitted',
  IN_PROGRESS: 'In progress',
  SUCCESS: 'Success',
  FAILURE: 'Failed',
  QUEUED: 'Queued',
  UNKNOWN: 'Unknown',
}
export function TasksPage({ initialQuery = '' }: { initialQuery?: string }) {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    money = useQuotaFormatter(),
    locale = toIntlLocale(i18n.language)
  const user = auth.bundle!.user,
    admin = user.role >= 10
  const {
    page,
    size,
    scope,
    draft,
    setDraft,
    filter,
    error: filterError,
    setError: setFilterError,
    restored,
    navigate,
  } = useTaskFilters(initialQuery, user.id, admin)
  const [selected, setSelected] = useState<TaskLog | null>(null)
  useEffect(() => setSelected(null), [filter, page, size, scope])
  const all = admin && scope === 'all'
  const query = useQuery({
    queryKey: ['tasks', user.id, all, page, size, filter],
    enabled: restored,
    queryFn: ({ signal }) => api<PageResult<TaskLog>>(`/api/task${all ? '' : '/self'}?${taskParams(filter, page, size, all)}`, { signal }),
    refetchInterval: (query) =>
      query.state.data?.items.some((task) => ['NOT_START', 'SUBMITTED', 'IN_PROGRESS', 'QUEUED'].includes(task.status)) ? 10_000 : false,
  })
  const current = query.data?.items.find((task) => task.id === selected?.id) || selected,
    total = query.data?.total ?? 0,
    pages = Math.max(1, Math.ceil(total / size))
  function date(seconds?: number) {
    return seconds ? new Date(seconds * 1000).toLocaleString(locale, { hour12: false }) : '—'
  }
  function patch(next: Partial<TaskFilters>) {
    setDraft((previous) => ({ ...previous, ...next }))
  }
  function searchTasks(event: FormEvent) {
    event.preventDefault()
    try {
      taskParams(draft, 1, size, all)
      navigate({ ...draft }, 1, size, all)
      setSelected(null)
    } catch (error) {
      setFilterError((error as Error).message)
    }
  }
  function reset() {
    navigate(initialTaskFilters(), 1, size, all)
    setSelected(null)
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Task logs')}</h1>
          <p>{t('Track asynchronous generation tasks and retrieve stored results.')}</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          <RefreshCw size={14} />
          {t('Refresh')}
        </Button>
      </div>
      <form className="console-toolbar task-filter-toolbar" onSubmit={searchTasks}>
        {admin && (
          <div className="field">
            <FilterSelect
              className="logs-filter-select"
              label={t('Scope')}
              value={scope}
              onChange={(value) => {
                const nextAll = value === 'all'
                navigate(nextAll ? filter : { ...filter, channel_id: '' }, 1, size, nextAll)
                setSelected(null)
              }}
              options={[
                { value: 'self', label: t('My records') },
                { value: 'all', label: t('All records') },
              ]}
            />
          </div>
        )}
        {[['task_id', 'Task ID'], ['platform', 'Platform'], ['action', 'Action'], ...(all ? [['channel_id', 'Channel ID']] : [])].map(
          ([key, label]) => (
            <label className="field" key={key}>
              <span>{t(label)}</span>
              <input type="search" value={draft[key as keyof TaskFilters]} onChange={(event) => patch({ [key]: event.target.value })} />
            </label>
          )
        )}
        <div className="field">
          <FilterSelect
            className="logs-filter-select"
            label={t('Status')}
            value={draft.status}
            onChange={(value) => patch({ status: value })}
            options={[
              { value: '', label: t('All statuses') },
              ...Object.values(TASK_STATUS).map((value) => ({ value, label: t(statusLabels[value]) })),
            ]}
          />
        </div>
        <label className="field">
          <span>{t('Start time')}</span>
          <input required type="datetime-local" step={1} value={draft.start} onChange={(event) => patch({ start: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('End time')}</span>
          <input required type="datetime-local" step={1} value={draft.end} onChange={(event) => patch({ end: event.target.value })} />
        </label>
        <div className="action-buttons">
          <Button variant="outline" type="submit">
            <Search size={14} />
            {t('Search')}
          </Button>
          <Button variant="ghost" type="button" onClick={reset}>
            {t('Reset')}
          </Button>
        </div>
      </form>
      {filterError && (
        <p role="alert" className="inline-error">
          {t(filterError)}
        </p>
      )}
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : (
        <>
          <div className="table-wrap task-log-table">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    'Task ID',
                    ...(all ? ['User', 'Channel'] : []),
                    'Model',
                    'Platform',
                    'Action',
                    'Status',
                    'Progress',
                    'Cost',
                    'Time',
                    'Duration',
                    'Details',
                  ].map((label) => (
                    <th key={label} className={['Progress', 'Cost', 'Duration'].includes(label) ? 'text-right' : undefined}>
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <span className="task-id">
                        <code title={task.task_id}>{task.task_id}</code>
                        <CopyButton value={task.task_id} />
                      </span>
                    </td>
                    {all && (
                      <>
                        <td>{task.username || task.user_id}</td>
                        <td>#{task.channel_id}</td>
                      </>
                    )}
                    <td>
                      <code>{task.properties?.origin_model_name || '—'}</code>
                    </td>
                    <td>{task.platform}</td>
                    <td>{task.action}</td>
                    <td>
                      <span className="task-status" data-status={task.status}>
                        {t(statusLabels[task.status] || task.status)}
                      </span>
                    </td>
                    <td className="text-right tabular-nums font-mono">
                      {task.progress || '—'}
                      {task.progress_message_en && <small className="small-note">{t(task.progress_message_en)}</small>}
                    </td>
                    <td className="text-right tabular-nums font-mono">{money(task.quota)}</td>
                    <td className="small-note tabular-nums font-mono">{date(task.submit_time)}</td>
                    <td className="text-right tabular-nums font-mono">
                      {task.finish_time && task.start_time ? `${formatNumber(Math.max(0, task.finish_time - task.start_time), locale)}s` : '—'}
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => setSelected(task)}>
                        {t('Details')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.items.length && <EmptyState title={t('No tasks in this period')} />}
          <div className="table-footer">
            <div className="log-page-size">
              {t('Rows per page')}{' '}
              <FilterSelect
                label={t('Rows per page')}
                hideLabel
                value={String(size)}
                onChange={(value) => {
                  navigate(filter, 1, Number(value), all)
                  setSelected(null)
                }}
                options={[10, 20, 30, 40, 50, 100].map((value) => ({ value: String(value), label: String(value) }))}
              />
            </div>
            <span>
              {query.data.total} {t('Tasks')}
            </span>
            <div>
              <Button
                size="icon"
                variant="outline"
                aria-label={t('Previous')}
                disabled={page === 1}
                onClick={() => navigate(filter, page - 1, size, all)}
              >
                <ChevronLeft size={15} />
              </Button>
              <span>
                {page}/{pages}
              </span>
              <Button
                size="icon"
                variant="outline"
                aria-label={t('Next')}
                disabled={page >= pages}
                onClick={() => navigate(filter, page + 1, size, all)}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        </>
      )}
      <Dialog
        open={!!current}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="task-detail-dialog">
          <DialogHeader>
            <DialogTitle>{t('Task details')}</DialogTitle>
          </DialogHeader>
          {current && (
            <>
              <dl className="settings-list">
                {[
                  ['Task ID', current.task_id],
                  ['Model', current.properties?.origin_model_name || '—'],
                  ['Status', t(statusLabels[current.status] || current.status)],
                  ['Progress', current.progress || '—'],
                  ...(current.properties?.upstream_model_name ? [['Actual Model', current.properties.upstream_model_name]] : []),
                  ['Platform', current.platform],
                  ['Action', current.action],
                  ['Group', current.group],
                  ['Cost', money(current.quota)],
                  ['Submitted', date(current.submit_time)],
                  ['Started', current.start_time ? date(current.start_time) : '—'],
                  ['Finished', current.finish_time ? date(current.finish_time) : '—'],
                  ...(all
                    ? [
                        ['User', current.username || String(current.user_id)],
                        ['Channel', String(current.channel_id)],
                        ...(current.admin_info?.request_id ? [['Request ID', current.admin_info.request_id]] : []),
                        ...(current.admin_info?.request_path ? [['Request Path', current.admin_info.request_path]] : []),
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div className="settings-row" key={label}>
                    <span>{t(label)}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </dl>
              {current.properties?.input && (
                <div className="task-prompt">
                  <h3>{t('Prompt')}</h3>
                  <p>{current.properties.input}</p>
                </div>
              )}
              {current.fail_reason && (
                <div className="error-state" role="alert">
                  {t(current.fail_reason)}
                </div>
              )}
              {all && current.admin_info && (
                <details className="task-native-data">
                  <summary>{t('Request details')}</summary>
                  <pre>{JSON.stringify(current.admin_info, null, 2)}</pre>
                </details>
              )}
              {all && user.role === 100 && current.root_info && (
                <details className="task-native-data">
                  <summary>{t('Runtime details')}</summary>
                  <pre>{JSON.stringify(current.root_info, null, 2)}</pre>
                </details>
              )}
              {current.data !== undefined && current.data !== null && (
                <details className="task-native-data">
                  <summary>{t('Response data')}</summary>
                  <pre>{JSON.stringify(current.data, null, 2)}</pre>
                </details>
              )}
              <TaskResult key={current.task_id} task={current} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
