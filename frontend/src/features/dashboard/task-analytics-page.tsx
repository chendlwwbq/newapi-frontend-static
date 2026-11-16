'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter, formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { MetricTrend } from '@/components/shared/metric-trend'
import { downloadCsv, toCsvLine } from '@/features/logs/export'
import { parseCustomUsageRange, usageRange } from './lib/analytics'

export interface TaskStatBucket {
  bucket_start: number
  label: string
  quota: number
  tasks: number
  success: number
  failure: number
  pending: number
  avg_duration_seconds: number
}

export interface TaskStatDimensionItem {
  key: string
  name?: string
  quota: number
  tasks: number
  success: number
  failure: number
}

export interface TaskStatResponse {
  granularity: string
  summary: {
    total_quota: number
    total_tasks: number
    success_tasks: number
    failure_tasks: number
    pending_tasks: number
    success_rate: number
    avg_duration_seconds: number
    refunded_tasks: number
  }
  timeline: TaskStatBucket[]
  dimensions: Record<string, TaskStatDimensionItem[]>
}

type TaskGranularity = 'day' | 'week' | 'month' | 'year'

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const total = Math.round(seconds)
  if (total < 60) return `${total}s`
  if (total < 3600) return `${Math.floor(total / 60)}m ${total % 60}s`
  return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`
}

function DimensionTable({
  title,
  items,
  money,
  number,
  t,
}: {
  title: string
  items: TaskStatDimensionItem[]
  money: (value: number) => string
  number: (value: number) => string
  t: (key: string) => string
}) {
  return (
    <section className="console-panel">
      <h2>{t(title)}</h2>
      {items.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {['', 'Tasks', 'Success', 'Failure', 'Cost'].map((label) => (
                  <th key={label}>{label ? t(label) : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <td>
                    {item.name ? (
                      <>
                        {item.name} <code>{item.key}</code>
                      </>
                    ) : (
                      <code>{item.key}</code>
                    )}
                  </td>
                  <td>{number(item.tasks)}</td>
                  <td>{number(item.success)}</td>
                  <td>{number(item.failure)}</td>
                  <td>{money(item.quota)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t('No data yet')} />
      )}
    </section>
  )
}

export function TaskAnalyticsPage() {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    money = useQuotaFormatter()
  const admin = (auth.bundle?.user.role || 0) >= 10
  const userId = auth.bundle?.user.id
  const [days, setDays] = useState(7)
  const [granularity, setGranularity] = useState<TaskGranularity>('day')
  const [metric, setMetric] = useState<'quota' | 'tasks' | 'success_rate'>('quota')
  const [scope, setScope] = useState<'self' | 'all'>('self')
  const [customRange, setCustomRange] = useState<{ start: number; end: number } | null>(null)
  const [draftStart, setDraftStart] = useState(''),
    [draftEnd, setDraftEnd] = useState(''),
    [rangeError, setRangeError] = useState('')
  const all = admin && scope === 'all'
  const range = useMemo(() => customRange || usageRange(days), [customRange, days])
  const params = new URLSearchParams({ start_timestamp: String(range.start), end_timestamp: String(range.end), granularity })
  const query = useQuery({
    queryKey: ['task-stat', userId, all ? 'all' : 'self', range.start, range.end, granularity],
    enabled: !!userId,
    queryFn: ({ signal }) => api<TaskStatResponse>(`/api/task/stat${all ? '' : '/self'}?${params}`, { signal }),
  })
  const stat = query.data
  const number = (value: number) => formatNumber(value, toIntlLocale(i18n.language))
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`
  const points = (stat?.timeline || []).map((bucket) => ({
    key: bucket.label,
    timestamp: bucket.bucket_start,
    value: metric === 'quota' ? bucket.quota : metric === 'tasks' ? bucket.tasks : bucket.tasks ? bucket.success / bucket.tasks : 0,
  }))
  const format = metric === 'quota' ? money : metric === 'tasks' ? number : percent
  const dimensions = stat?.dimensions || {}
  const orderedDimensions: [string, TaskStatDimensionItem[]][] = (
    [
      ['Model', dimensions.model],
      ['Channel', dimensions.channel],
      ['Platform', dimensions.platform],
      ['Type', dimensions.action],
      ['Status', dimensions.status],
      ...(all ? [['User', dimensions.user] as [string, TaskStatDimensionItem[]]] : []),
    ] as [string, TaskStatDimensionItem[]][]
  ).filter((entry): entry is [string, TaskStatDimensionItem[]] => Array.isArray(entry[1]))
  function exportTimeline() {
    const rows = [
      ['bucket', 'tasks', 'success', 'failure', 'pending', 'quota', 'avg_duration_seconds'],
      ...(stat?.timeline || []).map((bucket) => [
        bucket.label,
        bucket.tasks,
        bucket.success,
        bucket.failure,
        bucket.pending,
        bucket.quota,
        bucket.avg_duration_seconds.toFixed(1),
      ]),
    ]
    downloadCsv(
      'new-api-task-stat.csv',
      rows.map((row) => toCsvLine(row.map(String)))
    )
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Task analytics')}</h1>
          <p>{t('Explore task costs, success rates and generation time.')}</p>
        </div>
      </div>
      <nav className="analytics-actions" aria-label={t('Usage analytics')}>
        <Link href="/dashboard/models">{t('Model analytics')}</Link>
        <Link href="/dashboard/flow">{t('Flow')}</Link>
        {admin && <Link href="/dashboard/users">{t('User Analytics')}</Link>}
        <Link href="/dashboard/tasks" aria-current="page">
          {t('Task analytics')}
        </Link>
      </nav>
      <section className="console-panel analytics-panel">
        <div className="analytics-heading">
          <h2>{t('Task analytics')}</h2>
          <div className="analytics-actions">
            <select
              className="plain-select"
              aria-label={t('Select time granularity')}
              value={granularity}
              onChange={(event) => setGranularity(event.target.value as TaskGranularity)}
            >
              {(
                [
                  ['day', 'Day'],
                  ['week', 'Week'],
                  ['month', 'Month'],
                  ['year', 'Year'],
                ] as const
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
            <select
              className="plain-select"
              aria-label={t('Time range')}
              value={customRange ? 'custom' : days}
              onChange={(event) => {
                const value = Number(event.target.value)
                setCustomRange(null)
                setRangeError('')
                setDays(value)
              }}
            >
              {customRange && (
                <option value="custom" disabled>
                  {t('Custom Time Range')}
                </option>
              )}
              {[1, 7, 14, 30, 90, 365].map((value) => (
                <option value={value} key={value}>
                  {t('Last {{count}} days', { count: value })}
                </option>
              ))}
            </select>
            <button className="icon-button" aria-label={t('Refresh')} onClick={() => void query.refetch()}>
              <RefreshCw size={14} />
            </button>
            <Button variant="outline" onClick={exportTimeline} disabled={!stat?.timeline.length}>
              <Download size={14} />
              {t('Export')}
            </Button>
          </div>
        </div>
        <details>
          <summary>{t('Custom Time Range')}</summary>
          <form
            className="console-toolbar"
            onSubmit={(event) => {
              event.preventDefault()
              const result = parseCustomUsageRange(draftStart, draftEnd, 730)
              if (result.error) {
                setRangeError(result.error)
                return
              }
              setRangeError('')
              setCustomRange(result.range)
            }}
          >
            <label className="field">
              <span>{t('Start time')}</span>
              <input type="datetime-local" value={draftStart} required onChange={(event) => setDraftStart(event.target.value)} />
            </label>
            <label className="field">
              <span>{t('End time')}</span>
              <input type="datetime-local" value={draftEnd} required onChange={(event) => setDraftEnd(event.target.value)} />
            </label>
            <Button type="submit" variant="outline">
              {t('Apply Filters')}
            </Button>
            {rangeError && (
              <p className="inline-error" role="alert">
                {t(rangeError, { days: 730 })}
              </p>
            )}
          </form>
        </details>
        {admin && (
          <form className="console-toolbar" onSubmit={(event) => event.preventDefault()}>
            <label className="field">
              <span>{t('Scope')}</span>
              <select value={scope} onChange={(event) => setScope(event.target.value as 'self' | 'all')}>
                <option value="self">{t('My records')}</option>
                <option value="all">{t('All records')}</option>
              </select>
            </label>
          </form>
        )}
        {query.isPending ? (
          <LoadingState />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : !stat || !stat.summary.total_tasks ? (
          <EmptyState title={t('No data yet')} />
        ) : (
          <>
            <div className="analytics-summary">
              {(
                [
                  ['quota', 'Total cost', money(stat.summary.total_quota)],
                  ['tasks', 'Tasks', number(stat.summary.total_tasks)],
                  ['success_rate', 'Success rate', percent(stat.summary.success_rate)],
                ] as const
              ).map(([key, label, value]) => (
                <button key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>
                  <span>{t(label)}</span>
                  <strong>{value}</strong>
                </button>
              ))}
            </div>
            <div className="stat-grid">
              {(
                [
                  ['Success', number(stat.summary.success_tasks)],
                  ['Failure', number(stat.summary.failure_tasks)],
                  ['Pending', number(stat.summary.pending_tasks)],
                  ['Refunded', number(stat.summary.refunded_tasks)],
                  ['Avg duration', formatDuration(stat.summary.avg_duration_seconds)],
                ] as const
              ).map(([label, value]) => (
                <div className="stat-card" key={label}>
                  <div>{t(label)}</div>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <MetricTrend
              points={points}
              format={format}
              date={(timestamp) => {
                const bucket = stat.timeline.find((item) => item.bucket_start === timestamp)
                return bucket?.label || ''
              }}
              title={t('Usage trend')}
              selectionLabel={t('Usage trend')}
              controlsLabel={t('Usage trend')}
            />
          </>
        )}
      </section>
      {!query.isPending && !query.error && stat && stat.summary.total_tasks > 0 && (
        <div className="console-columns">
          {orderedDimensions.map(([title, items]) => (
            <DimensionTable key={title} title={title} items={items} money={money} number={number} t={t} />
          ))}
        </div>
      )}
    </>
  )
}
