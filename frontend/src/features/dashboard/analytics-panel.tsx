'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { QuotaData } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { formatNumber, useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { UsageChart } from './usage-chart'
import {
  aggregateUsage,
  aggregateUserUsage,
  parseCustomUsageRange,
  refreshAnalytics,
  selectableUsageDays,
  usageRange,
  type UsageGranularity,
  type UserUsageRow,
} from './lib/analytics'
import { downloadCsv, toCsvLine } from '@/features/logs/export'
import { loadAnalyticsPreferences, loadAnalyticsSession, localDateTimeInput, saveAnalyticsPreferences, saveAnalyticsSession } from './lib/preferences'

const TrafficFlow = dynamic(() => import('./traffic-flow').then((module) => module.TrafficFlow), { loading: () => <LoadingState /> })
const PerformanceHealth = dynamic(() => import('./performance-health').then((module) => module.PerformanceHealth), {
  loading: () => <LoadingState />,
})
const UserAnalytics = dynamic(() => import('./user-analytics').then((module) => module.UserAnalytics), { loading: () => <LoadingState /> })
const ModelAnalytics = dynamic(() => import('./model-analytics').then((module) => module.ModelAnalytics), { loading: () => <LoadingState /> })

export function AnalyticsPanel({ compact = false, initialView = 'models' }: { compact?: boolean; initialView?: 'models' | 'flow' | 'users' }) {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    money = useQuotaFormatter()
  const queryClient = useQueryClient()
  const [days, setDays] = useState(7),
    [revision, setRevision] = useState(0)
  const [metric, setMetric] = useState<'quota' | 'requests' | 'tokens'>('quota')
  const [filter, setFilter] = useState('')
  const [scope, setScope] = useState<'self' | 'all'>(initialView === 'models' ? 'self' : 'all'),
    [username, setUsername] = useState(''),
    [appliedUser, setAppliedUser] = useState('')
  const [selectedGranularity, setGranularity] = useState<UsageGranularity | null>(null)
  const [restoredId, setRestoredId] = useState<number | null>(null)
  const [customRange, setCustomRange] = useState<{ start: number; end: number } | null>(null)
  const [draftStart, setDraftStart] = useState(''),
    [draftEnd, setDraftEnd] = useState(''),
    [rangeError, setRangeError] = useState('')
  const userId = auth.bundle?.user.id
  const restored = !!userId && restoredId === userId
  const admin = (auth.bundle?.user.role || 0) >= 10,
    all = admin && !compact && (initialView === 'users' || scope === 'all')
  const showModels = compact || initialView === 'models',
    showUsers = !compact && initialView === 'users' && admin,
    showFlow = !compact && initialView === 'flow'
  useEffect(() => {
    if (!userId) return
    try {
      const preferences = loadAnalyticsPreferences(localStorage, userId)
      setDays(preferences.days)
      setGranularity(preferences.granularity)
    } catch {
      setDays(7)
      setGranularity(null)
    }
    let saved = { range: null, username: '' } as ReturnType<typeof loadAnalyticsSession>
    if (!compact)
      try {
        saved = loadAnalyticsSession(sessionStorage, userId)
      } catch {
        /* Keep defaults if storage is unavailable. */
      }
    setCustomRange(saved.range)
    setUsername(saved.username)
    setAppliedUser(saved.username)
    setDraftStart(saved.range ? localDateTimeInput(saved.range.start) : '')
    setDraftEnd(saved.range ? localDateTimeInput(saved.range.end) : '')
    setRangeError('')
    setRestoredId(userId)
  }, [userId, compact])
  const status = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) =>
      api<{ enable_data_export: boolean; data_export_default_time?: string; log_max_range_days?: number }>('/api/status', {
        signal,
        anonymous: true,
      }),
    staleTime: 60_000,
  })
  const limit = Number.isFinite(status.data?.log_max_range_days) ? Math.max(1, Math.floor(status.data!.log_max_range_days!)) : 365
  const actualDays = Math.min(days, limit),
    dayOptions = selectableUsageDays(limit, actualDays)
  const range = useMemo(() => customRange || usageRange(actualDays, limit), [customRange, actualDays, limit, revision])
  const rangeAllowed = !customRange || customRange.end - customRange.start <= limit * 86400
  const params = new URLSearchParams({ start_timestamp: String(range.start), end_timestamp: String(range.end) })
  if (all && appliedUser) params.set('username', appliedUser)
  const query = useQuery({
    queryKey: ['usage-data', userId, range.start, range.end, ...(all ? ['all', appliedUser] : [])],
    queryFn: ({ signal }) => api<QuotaData[] | null>(`/api/data/${all ? '' : 'self'}?${params}`, { signal }),
    enabled: showModels && !!userId && restored && !!status.data && !status.error && rangeAllowed,
  })
  const userQuery = useQuery({
    queryKey: ['usage-users', userId, range.start, range.end],
    enabled: showUsers && !!userId && restored && !!status.data && !status.error && rangeAllowed,
    queryFn: ({ signal }) =>
      api<UserUsageRow[] | null>(
        `/api/data/users?${new URLSearchParams({ start_timestamp: String(range.start), end_timestamp: String(range.end) })}`,
        { signal }
      ),
  })
  const configured = status.data?.data_export_default_time
  const granularity = selectedGranularity || (configured === 'hour' || configured === 'week' || configured === 'day' ? configured : 'day')
  const usage = useMemo(
    () =>
      showModels
        ? aggregateUsage(query.data || [], range.start, range.end, granularity)
        : { totals: { requests: 0, tokens: 0, quota: 0, cacheRead: 0, cacheCreation: 0 }, models: [], days: [] },
    [showModels, query.data, range, granularity]
  )
  const number = (value: number) => new Intl.NumberFormat(toIntlLocale(i18n.language), { maximumFractionDigits: 0 }).format(value)
  const format = metric === 'quota' ? money : number
  const models = usage.models.filter((model) => model.model.toLowerCase().includes(filter.toLowerCase()))
  const users = useMemo(() => aggregateUserUsage(userQuery.data || [], appliedUser), [userQuery.data, appliedUser])
  function exportUsage() {
    const rows = [
      ['model', 'requests', 'tokens', 'quota', 'cache_read_tokens', 'cache_creation_tokens'],
      ...models.map((model) => [model.model, model.requests, model.tokens, model.quota, model.cacheRead, model.cacheCreation]),
    ]
    downloadCsv(
      'new-api-usage.csv',
      rows.map((row) => toCsvLine(row.map(String)))
    )
  }
  function exportUsers() {
    const rows = [['username', 'requests', 'tokens', 'quota'], ...users.map((user) => [user.username, user.requests, user.tokens, user.quota])]
    downloadCsv(
      'new-api-user-usage.csv',
      rows.map((row) => toCsvLine(row.map(String)))
    )
  }
  return (
    <section className="console-panel analytics-panel">
      <div className="analytics-heading">
        <h2>{t('Usage analytics')}</h2>
        <div className="analytics-actions">
          <select
            className="plain-select"
            aria-label={t('Select time granularity')}
            value={granularity}
            disabled={!restored || !status.data || !!status.error}
            onChange={(event) => {
              const value = event.target.value as UsageGranularity
              setGranularity(value)
              if (userId) saveAnalyticsPreferences(userId, { days, granularity: value })
            }}
          >
            {[
              ['hour', 'Hour'],
              ['day', 'Day'],
              ['week', 'Week'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
          <select
            className="plain-select"
            aria-label={t('Time range')}
            value={customRange ? 'custom' : actualDays}
            disabled={!restored || !status.data || !!status.error}
            onChange={(event) => {
              const value = Number(event.target.value)
              setCustomRange(null)
              setRangeError('')
              setDays(value)
              if (userId) {
                saveAnalyticsPreferences(userId, { days: value, granularity: selectedGranularity })
                if (!compact) saveAnalyticsSession(userId, { range: null, username: appliedUser })
              }
            }}
          >
            {customRange && (
              <option value="custom" disabled>
                {t('Custom Time Range')}
              </option>
            )}
            {dayOptions.map((value) => (
              <option value={value} key={value}>
                {t('Last {{count}} days', { count: value })}
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            aria-label={t('Refresh')}
            disabled={!rangeAllowed || !restored || !status.data || !!status.error}
            onClick={() =>
              refreshAnalytics(
                !!customRange,
                range.end,
                Math.floor(Date.now() / 1000),
                () => {
                  if (showModels) void query.refetch()
                  if (showUsers) void userQuery.refetch()
                  if (showFlow) void queryClient.invalidateQueries({ queryKey: ['traffic-flow', userId] })
                },
                () => setRevision((value) => value + 1)
              )
            }
          >
            <RefreshCw size={14} />
          </button>
          {showModels && !compact && (
            <Button variant="outline" onClick={exportUsage} disabled={!models.length || !!status.error || !rangeAllowed}>
              <Download size={14} />
              {t('Export')}
            </Button>
          )}
        </div>
      </div>
      {!compact && (
        <details>
          <summary>{t('Custom Time Range')}</summary>
          <form
            className="console-toolbar"
            onSubmit={(event) => {
              event.preventDefault()
              const result = parseCustomUsageRange(draftStart, draftEnd, limit)
              if (result.error) {
                setRangeError(result.error)
                return
              }
              setRangeError('')
              setCustomRange(result.range)
              if (userId) saveAnalyticsSession(userId, { range: result.range, username: appliedUser })
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
            <Button type="submit" variant="outline" disabled={!status.data || !!status.error}>
              {t('Apply Filters')}
            </Button>
            {rangeError && (
              <p className="inline-error" role="alert">
                {t(rangeError, { days: limit })}
              </p>
            )}
          </form>
        </details>
      )}
      {status.data?.enable_data_export === false && (
        <p className="small-note" role="status">
          {t('Data Dashboard')}: {t('Disabled')}
        </p>
      )}
      {admin && !compact && restored && (
        <form
          className="console-toolbar"
          onSubmit={(event) => {
            event.preventDefault()
            const value = username.trim()
            setAppliedUser(value)
            if (userId) saveAnalyticsSession(userId, { range: customRange, username: value })
          }}
        >
          {!showUsers && (
            <label className="field">
              <span>{t('Scope')}</span>
              <select
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as 'self' | 'all')
                  setUsername('')
                  setAppliedUser('')
                  if (userId) saveAnalyticsSession(userId, { range: customRange, username: '' })
                }}
              >
                <option value="self">{t('My records')}</option>
                <option value="all">{t('All records')}</option>
              </select>
            </label>
          )}
          {all && (
            <>
              <label className="field">
                <span>{t('Username')}</span>
                <input type="search" value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              <Button type="submit" variant="outline">
                {t('Search')}
              </Button>
            </>
          )}
        </form>
      )}
      {status.error ? (
        <ErrorState error={status.error} retry={() => status.refetch()} />
      ) : !restored ? (
        <LoadingState />
      ) : !rangeAllowed ? (
        <p className="inline-error" role="alert">
          {t('The time range cannot exceed {{days}} days', { days: limit })}
        </p>
      ) : status.isPending || !restored || (showModels && query.isPending) ? (
        <LoadingState />
      ) : showModels && query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : (
        <>
          {showModels && (
            <>
              <div className="analytics-summary">
                {(
                  [
                    ['quota', 'Usage', money(usage.totals.quota)],
                    ['requests', 'Requests', number(usage.totals.requests)],
                    ['tokens', 'Tokens', number(usage.totals.tokens)],
                  ] as const
                ).map(([key, label, value]) => (
                  <button key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>
                    <span>{t(label)}</span>
                    <strong>{value}</strong>
                  </button>
                ))}
              </div>
              {!compact && (
                <div className="stat-grid">
                  {(
                    [
                      ['Cache read', usage.totals.cacheRead],
                      ['Cache creation', usage.totals.cacheCreation],
                      ['Average RPM', (usage.totals.requests * 60) / Math.max(1, range.end - range.start)],
                      ['Average TPM', (usage.totals.tokens * 60) / Math.max(1, range.end - range.start)],
                    ] as const
                  ).map(([label, value]) => (
                    <div className="stat-card" key={label}>
                      <div>{t(label)}</div>
                      <strong>{formatNumber(value, toIntlLocale(i18n.language))}</strong>
                    </div>
                  ))}
                </div>
              )}
              {admin && !compact && <PerformanceHealth />}
              {compact || !usage.models.length ? (
                <UsageChart days={usage.days} metric={metric} format={format} granularity={granularity} />
              ) : (
                <ModelAnalytics
                  rows={query.data || []}
                  start={range.start}
                  end={range.end}
                  granularity={granularity}
                  metric={metric}
                  format={format}
                />
              )}
              {!usage.models.length && (
                <p className="analytics-note">
                  {t('No usage in this period. Aggregated data appears after collection is enabled and requests are recorded.')}
                </p>
              )}
              {!compact && (
                <>
                  <label className="search-field">
                    <input
                      aria-label={t('Search models')}
                      placeholder={t('Search models')}
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    />
                  </label>
                  {models.length ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {['Model', 'Requests', 'Tokens', 'Cache read', 'Cache creation', 'Usage'].map((label) => (
                              <th key={label}>{t(label)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {models.map((model) => (
                            <tr key={model.model}>
                              <td>
                                <code>{model.model}</code>
                              </td>
                              <td>{number(model.requests)}</td>
                              <td>{number(model.tokens)}</td>
                              <td>{number(model.cacheRead)}</td>
                              <td>{number(model.cacheCreation)}</td>
                              <td>{money(model.quota)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title={t(filter ? 'No matching models' : 'No data yet')} />
                  )}
                </>
              )}
            </>
          )}
          {showUsers && (
            <section>
              <div className="analytics-heading">
                <h2>{t('Users')}</h2>
                <Button variant="outline" onClick={exportUsers} disabled={!users.length || !!userQuery.error}>
                  <Download size={14} />
                  {t('Export')}
                </Button>
              </div>
              {userQuery.error ? (
                <ErrorState error={userQuery.error} retry={() => userQuery.refetch()} />
              ) : userQuery.isPending ? (
                <LoadingState />
              ) : users.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {['Username', 'Requests', 'Tokens', 'Usage'].map((label) => (
                          <th key={label}>{t(label)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.username}>
                          <td>{user.username}</td>
                          <td>{number(user.requests)}</td>
                          <td>{number(user.tokens)}</td>
                          <td>{money(user.quota)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title={t('No data yet')} />
              )}
            </section>
          )}
          {showUsers && !userQuery.isPending && !userQuery.error && users.length > 0 && (
            <UserAnalytics rows={userQuery.data || []} granularity={granularity} username={appliedUser} />
          )}
          {showFlow && userId && (
            <TrafficFlow
              key={`${userId}:${all}:${appliedUser}`}
              userId={userId}
              role={all ? (auth.bundle?.user.role === 100 ? 'root' : 'admin') : 'user'}
              start={range.start}
              end={range.end}
              username={all ? appliedUser : ''}
              initialOpen={initialView === 'flow'}
            />
          )}
        </>
      )}
    </section>
  )
}
