'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Download, RefreshCw, Search } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { PageResult } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter, formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { toIntlLocale } from '@/i18n/languages'
import { buildLogParams, initialLogFilters, logLink, logParams, readLogLink, LOG_TYPES, type LogFilters, type LogRow } from './contracts'
import { LogExportDialog } from './export-dialog'

interface LogStats {
  quota: number
  rpm: number
  tpm: number
}

interface LogExportStatus {
  log_export_enabled?: boolean
  log_export_max_range?: number
  log_max_range_days?: number
}

function advancedFilterCount(filters: LogFilters, all: boolean): number {
  return [filters.token_name, filters.request_id, filters.upstream_request_id, ...(all ? [filters.username, filters.channel] : [])].filter((value) =>
    value.trim()
  ).length
}

export function LogsPage({ initialQuery = '' }: { initialQuery?: string }) {
  const { t, i18n } = useTranslation()
  const auth = useAuth()
  const money = useQuotaFormatter()
  const locale = toIntlLocale(i18n.language)
  const user = auth.bundle!.user
  const admin = user.role >= 10
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [scope, setScope] = useState<'self' | 'all'>('self')
  const [draft, setDraft] = useState<LogFilters>(initialLogFilters)
  const [filter, setFilter] = useState<LogFilters>(draft)
  const [error, setError] = useState('')
  const [restored, setRestored] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [exportParams, setExportParams] = useState<string | null>(null)
  const all = admin && scope === 'all'

  useEffect(() => {
    function restore(queryString: string, expandActive: boolean) {
      const link = readLogLink(queryString)
      const nextAll = admin && link.scope === 'all'
      setDraft(link.filters)
      setFilter(link.filters)
      setPage(link.page)
      setSize(link.size)
      setScope(nextAll ? 'all' : 'self')
      if (expandActive) setAdvancedOpen(advancedFilterCount(link.filters, nextAll) > 0)
      setError('')
      setRestored(true)
    }
    restore(initialQuery, true)
    const onPopState = () => restore(window.location.search, false)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [initialQuery, user.id, admin])

  const query = useQuery({
    queryKey: ['logs', user.id, all, page, size, filter],
    enabled: restored,
    queryFn: ({ signal }) => api<PageResult<LogRow>>(`/api/log${all ? '' : '/self'}?${logParams(filter, page, size, all)}`, { signal }),
  })
  const statsQuery = useQuery({
    queryKey: ['logs-stats', user.id, all, filter],
    enabled: restored,
    queryFn: ({ signal }) => api<LogStats>(`/api/log${all ? '' : '/self'}/stat?${buildLogParams(filter, all, true)}`, { signal }),
  })
  const statusQuery = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => api<LogExportStatus>('/api/status', { signal }),
    staleTime: 300_000,
  })
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))

  function navigate(filters: LogFilters, nextPage: number, nextSize: number, nextAll: boolean) {
    window.history.pushState(null, '', `${window.location.pathname}?${logLink(filters, nextPage, nextSize, nextAll)}${window.location.hash}`)
    setDraft(filters)
    setFilter(filters)
    setPage(nextPage)
    setSize(nextSize)
    setScope(nextAll ? 'all' : 'self')
    setError('')
  }

  function patch(next: Partial<LogFilters>) {
    setDraft((previous) => ({ ...previous, ...next }))
  }

  function search(event: FormEvent) {
    event.preventDefault()
    try {
      logParams(draft, 1, size, all)
      navigate({ ...draft }, 1, size, all)
    } catch (cause) {
      setError((cause as Error).message)
    }
  }

  function openExport() {
    try {
      setExportParams(buildLogParams(filter, all).toString())
      setError('')
    } catch (cause) {
      setError((cause as Error).message)
    }
  }

  const advancedCount = advancedFilterCount(draft, all)
  const exportAllowed = admin || statusQuery.data?.log_export_enabled !== false
  const exportMaxRange = statusQuery.data?.log_export_max_range ?? statusQuery.data?.log_max_range_days ?? 7

  const date = (seconds: number) => new Date(seconds * 1000).toLocaleString(locale, { hour12: false })
  const typeLabel = (type: number) => t(LOG_TYPES.find((item) => item.value === String(type))?.label || 'Unknown')

  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Logs')}</h1>
          <p>{t('Inspect request logs, quotas and token usage.')}</p>
        </div>
        <div className="action-buttons">
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch()
              void statsQuery.refetch()
            }}
          >
            <RefreshCw size={14} />
            {t('Refresh')}
          </Button>
          {exportAllowed && (
            <Button variant="outline" onClick={openExport}>
              <Download size={14} />
              {t('Export')}
            </Button>
          )}
        </div>
      </div>
      <form className="console-toolbar" onSubmit={search}>
        {admin && (
          <div className="field">
            <FilterSelect
              className="logs-filter-select"
              label={t('Scope')}
              value={scope}
              onChange={(value) => navigate(value === 'all' ? filter : { ...filter, username: '', channel: '' }, 1, size, value === 'all')}
              options={[
                { value: 'self', label: t('My records') },
                { value: 'all', label: t('All records') },
              ]}
            />
          </div>
        )}
        <div className="field">
          <FilterSelect
            className="logs-filter-select"
            label={t('Type')}
            value={draft.type}
            onChange={(value) => patch({ type: value })}
            options={[{ value: '', label: t('All') }, ...LOG_TYPES.map((item) => ({ value: item.value, label: t(item.label) }))]}
          />
        </div>
        <label className="field">
          <span>{t('Model')}</span>
          <input type="search" value={draft.model_name} onChange={(event) => patch({ model_name: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('Group')}</span>
          <input type="search" value={draft.group} onChange={(event) => patch({ group: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('Start time')}</span>
          <input required type="datetime-local" step={1} value={draft.start} onChange={(event) => patch({ start: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('End time')}</span>
          <input required type="datetime-local" step={1} value={draft.end} onChange={(event) => patch({ end: event.target.value })} />
        </label>
        <details className="field-span" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
          <summary>
            {t(advancedOpen ? 'Collapse' : 'Expand')}
            {advancedCount ? ` (${advancedCount})` : ''}
          </summary>
          <div className="log-advanced-filters">
            {[
              ['token_name', 'Token name'],
              ['request_id', 'Request ID'],
              ['upstream_request_id', 'Upstream Request ID'],
              ...(all
                ? [
                    ['username', 'Username'],
                    ['channel', 'Channel ID'],
                  ]
                : []),
            ].map(([key, label]) => (
              <label className="field" key={key}>
                <span>{t(label)}</span>
                <input type="search" value={draft[key as keyof LogFilters]} onChange={(event) => patch({ [key]: event.target.value })} />
              </label>
            ))}
          </div>
        </details>
        <div className="action-buttons">
          <Button variant="outline" type="submit">
            <Search size={14} />
            {t('Search')}
          </Button>
          <Button variant="ghost" type="button" onClick={() => navigate(initialLogFilters(), 1, size, all)}>
            {t('Reset')}
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="inline-error">
          {t(error)}
        </p>
      )}
      {statsQuery.isError ? (
        <div className="log-stats" role="status">
          {t('Stats unavailable')}
        </div>
      ) : (
        <>
          <div className="log-stats">
            <div className="log-stat">
              <span>{t('Quota')}</span>
              <strong className="tabular-nums font-mono">{statsQuery.data ? money(statsQuery.data.quota) : '—'}</strong>
            </div>
            <div className="log-stat">
              <span>RPM</span>
              <strong className="tabular-nums font-mono">{statsQuery.data ? formatNumber(statsQuery.data.rpm, locale) : '—'}</strong>
            </div>
            <div className="log-stat">
              <span>TPM</span>
              <strong className="tabular-nums font-mono">{statsQuery.data ? formatNumber(statsQuery.data.tpm, locale) : '—'}</strong>
            </div>
          </div>
          <p className="small-note">
            {t(
              'Cost covers consumption in the selected time range. RPM and TPM cover the latest 60 seconds. Log type and request IDs filter records only.'
            )}
          </p>
        </>
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
                  {['Time', ...(all ? ['Username'] : []), 'Type', 'Model', 'Token', 'Channel', 'Tokens', 'Cost', 'Duration', 'Details'].map(
                    (label) => (
                      <th key={label} className={['Tokens', 'Cost', 'Duration'].includes(label) ? 'text-right' : undefined}>
                        {t(label)}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="small-note tabular-nums font-mono">{date(row.created_at)}</td>
                    {all && <td>{row.username || row.user_id}</td>}
                    <td>{typeLabel(row.type)}</td>
                    <td>
                      <code>{row.model_name || '—'}</code>
                    </td>
                    <td>{row.token_name || '—'}</td>
                    <td>{row.channel ? `#${row.channel}${row.channel_name ? ` ${row.channel_name}` : ''}` : '—'}</td>
                    <td className="small-note text-right tabular-nums font-mono">
                      {formatNumber(row.prompt_tokens, locale)} / {formatNumber(row.completion_tokens, locale)}
                    </td>
                    <td className="text-right tabular-nums font-mono">{money(row.quota)}</td>
                    <td className="text-right tabular-nums font-mono">{row.use_time ? `${row.use_time}s` : '—'}</td>
                    <td>
                      {row.request_id ? (
                        <span className="task-id">
                          <code title={row.request_id}>{row.request_id}</code>
                          <CopyButton value={row.request_id} />
                        </span>
                      ) : (
                        <span className="small-note">{row.content}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.items.length && <EmptyState title={t('No logs in this period')} />}
          <div className="table-footer">
            <div className="log-page-size">
              {t('Rows per page')}{' '}
              <FilterSelect
                label={t('Rows per page')}
                hideLabel
                value={String(size)}
                onChange={(value) => navigate(filter, 1, Number(value), all)}
                options={[10, 20, 30, 40, 50, 100].map((value) => ({ value: String(value), label: String(value) }))}
              />
            </div>
            <span>
              {total} {t('Logs')}
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
      {exportParams !== null && (
        <LogExportDialog params={exportParams} admin={all} maxRangeDays={exportMaxRange} onClose={() => setExportParams(null)} />
      )}
    </>
  )
}
