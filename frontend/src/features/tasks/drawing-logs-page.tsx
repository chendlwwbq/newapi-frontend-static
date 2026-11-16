'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { PageResult } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { drawingParams, initialTaskFilters } from './lib/task-filters'
import { useTaskFilters } from './lib/use-task-filters'

type DrawingLog = {
  id: number
  user_id: number
  channel_id: number
  mj_id: string
  action: string
  status: string
  progress: string
  quota: number
  submit_time: number
  start_time: number
  finish_time: number
  prompt: string
  prompt_en: string
  description: string
  fail_reason: string
  image_url: string
  video_url: string
  video_urls: string
}
const labels: Record<string, string> = {
  NOT_START: 'Not started',
  SUBMITTED: 'Submitted',
  IN_PROGRESS: 'In progress',
  SUCCESS: 'Success',
  FAILURE: 'Failed',
  QUEUED: 'Queued',
  UNKNOWN: 'Unknown',
}

function mediaURL(value: string) {
  if (!value) return ''
  try {
    const url = new URL(value, 'https://relative.invalid')
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : ''
  } catch {
    return ''
  }
}
function videoURLs(task: DrawingLog) {
  let urls: string[] = []
  try {
    const parsed: unknown = JSON.parse(task.video_urls || '[]')
    if (Array.isArray(parsed)) urls = parsed.filter((url): url is string => typeof url === 'string')
  } catch {
    /* Older records may not contain a video list. */
  }
  return [...new Set([task.video_url, ...urls].map(mediaURL).filter(Boolean))]
}

export function DrawingLogsPage({ initialQuery = '' }: { initialQuery?: string }) {
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
  const [selected, setSelected] = useState<DrawingLog | null>(null)
  useEffect(() => setSelected(null), [filter, page, size, scope])
  const all = admin && scope === 'all'
  const query = useQuery({
    queryKey: ['drawing-logs', user.id, all, page, size, filter],
    enabled: restored,
    queryFn: ({ signal }) => api<PageResult<DrawingLog>>(`/api/mj${all ? '/' : '/self'}?${drawingParams(filter, page, size, all)}`, { signal }),
  })
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / size))
  const current = query.data?.items?.find((item) => item.id === selected?.id) || selected
  function date(value: number) {
    return value ? new Date(value).toLocaleString(locale, { hour12: false }) : '—'
  }
  function search(event: FormEvent) {
    event.preventDefault()
    try {
      drawingParams(draft, 1, size, all)
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
        <h1>{t('Drawing Logs')}</h1>
        <Button variant="outline" onClick={() => query.refetch()}>
          <RefreshCw size={14} />
          {t('Refresh')}
        </Button>
      </div>
      <form className="console-toolbar task-filter-toolbar" onSubmit={search}>
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
        <label className="field">
          <span>{t('Task ID')}</span>
          <input type="search" value={draft.task_id} onChange={(event) => setDraft({ ...draft, task_id: event.target.value })} />
        </label>
        {all && (
          <label className="field">
            <span>{t('Channel ID')}</span>
            <input type="search" value={draft.channel_id} onChange={(event) => setDraft({ ...draft, channel_id: event.target.value })} />
          </label>
        )}
        <label className="field">
          <span>{t('Start time')}</span>
          <input
            required
            type="datetime-local"
            step={1}
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
          />
        </label>
        <label className="field">
          <span>{t('End time')}</span>
          <input required type="datetime-local" step={1} value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} />
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
                  {['Task ID', ...(all ? ['User', 'Channel'] : []), 'Action', 'Status', 'Progress', 'Cost', 'Time', 'Details'].map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(query.data.items || []).map((task) => (
                  <tr key={task.id}>
                    <td>
                      <span className="task-id">
                        <code title={task.mj_id}>{task.mj_id}</code>
                        <CopyButton value={task.mj_id} />
                      </span>
                    </td>
                    {all && (
                      <>
                        <td>{task.user_id}</td>
                        <td>#{task.channel_id}</td>
                      </>
                    )}
                    <td>{task.action}</td>
                    <td>
                      <span className="task-status" data-status={task.status}>
                        {t(labels[task.status] || task.status)}
                      </span>
                    </td>
                    <td>{task.progress || '—'}</td>
                    <td className="tabular-nums font-mono">{money(task.quota)}</td>
                    <td className="small-note tabular-nums font-mono">{date(task.submit_time)}</td>
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
          {!query.data.items?.length && <EmptyState title={t('No tasks in this period')} />}
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
                  ['Task ID', current.mj_id],
                  ['Action', current.action],
                  ['Status', t(labels[current.status] || current.status)],
                  ['Progress', current.progress],
                  ['Cost', money(current.quota)],
                  ['Submitted', date(current.submit_time)],
                  ['Started', date(current.start_time)],
                  ['Finished', date(current.finish_time)],
                  ...(all
                    ? [
                        ['User', String(current.user_id)],
                        ['Channel', String(current.channel_id)],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div className="settings-row" key={label}>
                    <span>{t(label)}</span>
                    <strong>{value || '—'}</strong>
                  </div>
                ))}
              </dl>
              {current.prompt && (
                <div className="task-prompt">
                  <h3>{t('Prompt')}</h3>
                  <p>{current.prompt}</p>
                </div>
              )}
              {current.prompt_en && current.prompt_en !== current.prompt && <p>{current.prompt_en}</p>}
              {current.description && <p>{current.description}</p>}
              {current.fail_reason && (
                <div className="error-state" role="alert">
                  {current.fail_reason}
                </div>
              )}
              {mediaURL(current.image_url) && (
                <div className="task-artifacts">
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted/60">
                    <img
                      src={mediaURL(current.image_url)}
                      alt={t('Image')}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <a href={mediaURL(current.image_url)} target="_blank" rel="noreferrer" className="text-link">
                    {t('Image')} ↗
                  </a>
                </div>
              )}
              {videoURLs(current).map((url) => (
                <div className="task-artifacts" key={url}>
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted/60">
                    <video src={url} controls preload="metadata" className="h-full w-full object-cover" />
                  </div>
                  <a href={url} target="_blank" rel="noreferrer" className="text-link">
                    {t('Video')} ↗
                  </a>
                </div>
              ))}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
