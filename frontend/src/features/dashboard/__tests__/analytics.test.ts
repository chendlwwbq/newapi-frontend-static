import { describe, expect, it, vi } from 'vitest'
import {
  aggregateUsage,
  aggregateUserUsage,
  parseCustomUsageRange,
  selectableUsageDays,
  usageRange,
  userUsageHistory,
  trendPosition,
  nearestTrendIndex,
  refreshAnalytics,
  recentUsageWindow,
} from '../lib/analytics'
import type { QuotaData } from '@/lib/api/types'
import { rankingHistory } from '@/features/catalog/rankings-history'
import {
  loadAnalyticsPreferences,
  saveAnalyticsPreferences,
  loadAnalyticsSession,
  saveAnalyticsSession,
  localDateTimeInput,
} from '../lib/preferences'

const start = new Date(2026, 9, 20).getTime() / 1000
const row: QuotaData = {
  id: 1,
  created_at: start + 3600,
  model_name: 'model-a',
  use_group: 'default',
  count: 2,
  quota: 150,
  token_used: 300,
  cache_read_tokens: 10,
  cache_creation_tokens: 5,
}
describe('usage aggregation', () => {
  it('positions and selects uneven trend samples by elapsed time', () => {
    const timestamps = [0, 3600, 86400]
    expect(trendPosition(timestamps, 0)).toBe(64)
    expect(trendPosition(timestamps, 2)).toBe(776)
    expect(trendPosition(timestamps, 1)).toBeCloseTo(64 + 712 / 24)
    expect(nearestTrendIndex(timestamps, 100)).toBe(1)
    expect(nearestTrendIndex(timestamps, 750)).toBe(2)
    expect(trendPosition([100], 0)).toBe(400)
  })

  it('includes the current hourly bucket and 23 preceding buckets as time advances', () => {
    expect(recentUsageWindow(100 * 3600 + 120)).toEqual({ start: 77 * 3600, end: 100 * 3600 + 120 })
    expect(recentUsageWindow(101 * 3600)).toEqual({ start: 78 * 3600, end: 101 * 3600 })
  })
  it('refetches a fixed range and a preset range refreshed within the same second', () => {
    const refetch = vi.fn(),
      advance = vi.fn()
    refreshAnalytics(true, 100, 100, refetch, advance)
    refreshAnalytics(false, 100, 100, refetch, advance)
    expect(refetch).toHaveBeenCalledTimes(2)
    expect(advance).not.toHaveBeenCalled()
    refreshAnalytics(false, 100, 101, refetch, advance)
    expect(advance).toHaveBeenCalledOnce()
  })
  it('uses local custom dates and enforces the configured range', () => {
    const from = '2026-10-20T10:00',
      to = '2026-10-21T10:00'
    expect(parseCustomUsageRange(from, to, 1)).toEqual({ range: { start: new Date(from).getTime() / 1000, end: new Date(to).getTime() / 1000 } })
    expect(parseCustomUsageRange(to, from, 1)).toEqual({ error: 'Invalid time range' })
    expect(parseCustomUsageRange(from, '2026-10-21T10:01', 1)).toEqual({ error: 'The time range cannot exceed {{days}} days' })
    expect(parseCustomUsageRange('', to, 1)).toEqual({ error: 'Invalid time range' })
  })
  it('ranks users by total quota and groups their history by time', () => {
    const rows = [
      { username: 'alice', created_at: start + 3600, count: 1, token_used: 10, quota: 10 },
      { username: 'bob', created_at: start + 7200, count: 1, token_used: 10, quota: 40 },
      { username: 'alice', created_at: start + 86400, count: 1, token_used: 10, quota: 50 },
    ]
    const history = userUsageHistory(rows, 'day', 1)
    expect(history.users.map((user) => user.username)).toEqual(['alice'])
    expect(history.buckets.map((bucket) => bucket.values.get('alice'))).toEqual([10, 50])
    expect(history.buckets[0].values.has('bob')).toBe(false)
    expect(userUsageHistory(rows, 'day', 10, 'bob').users[0].quota).toBe(40)
  })
  it('ranks and groups model series by the selected metric', () => {
    const rows = [
      { username: 'model-a', created_at: start + 3600, count: 8, token_used: 2, quota: 1 },
      { username: 'model-b', created_at: start + 7200, count: 1, token_used: 50, quota: 20 },
    ]
    const requests = userUsageHistory(rows, 'hour', 1, '', 'requests')
    const tokens = userUsageHistory(rows, 'hour', 1, '', 'tokens')
    expect(requests.users[0].username).toBe('model-a')
    expect(requests.buckets[0].values.get('model-a')).toBe(8)
    expect(tokens.users[0].username).toBe('model-b')
    expect(tokens.buckets[1].values.get('model-b')).toBe(50)
  })
  it('aggregates native all-user rows and applies exact username filters', () => {
    const rows = [
      { username: 'alice', count: 2, token_used: 10, quota: 50 },
      { username: 'bob', count: 1, token_used: 5, quota: 100 },
      { username: 'alice', count: 3, token_used: 15, quota: 20 },
    ]
    expect(aggregateUserUsage(rows)).toEqual([
      { username: 'bob', requests: 1, tokens: 5, quota: 100 },
      { username: 'alice', requests: 5, tokens: 25, quota: 70 },
    ])
    expect(aggregateUserUsage(rows, 'alice')).toEqual([{ username: 'alice', requests: 5, tokens: 25, quota: 70 }])
    expect(aggregateUserUsage(rows, 'ali')).toEqual([])
  })
  it('respects a shorter server range, including a nonstandard number of days', () => {
    expect(selectableUsageDays(3, 3)).toEqual([1, 3])
    expect(selectableUsageDays(365, 3)).toEqual([1, 3, 7, 14, 29, 30])
    const clock = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 9, 27, 23, 30).getTime())
    try {
      const range = usageRange(30, 3)
      expect(range.end - range.start).toBe(3 * 86400)
    } finally {
      clock.mockRestore()
    }
  })
  it('combines models across groups while retaining cache usage and filling idle days', () => {
    const usage = aggregateUsage(
      [row, { ...row, id: 2, use_group: 'vip', count: 1, quota: 100, token_used: 200, cache_read_tokens: 20, cache_creation_tokens: 0 }],
      start,
      start + 86400 * 2
    )
    expect(usage.totals).toEqual({ requests: 3, quota: 250, tokens: 500, cacheRead: 30, cacheCreation: 5 })
    expect(usage.models).toHaveLength(1)
    expect(usage.days).toHaveLength(3)
    expect(usage.days[1].requests).toBe(0)
  })
  it('excludes out-of-range rows and orders models by actual cost', () => {
    const usage = aggregateUsage(
      [row, { ...row, model_name: 'model-b', quota: 200 }, { ...row, created_at: start - 1, quota: 999 }],
      start,
      start + 86400
    )
    expect(usage.models.map((model) => model.model)).toEqual(['model-b', 'model-a'])
    expect(usage.totals.quota).toBe(350)
  })
  it('keeps selected model trends separate across time buckets', () => {
    const rows = [row, { ...row, model_name: 'model-b', created_at: start + 86400, quota: 200 }, { ...row, created_at: start + 86400, quota: 25 }]
    const selected = aggregateUsage(
      rows.filter((item) => item.model_name === 'model-a'),
      start,
      start + 2 * 86400,
      'day'
    )
    expect(selected.days.map((day) => day.quota)).toEqual([150, 25, 0])
    expect(selected.totals.quota).toBe(175)
  })
  it('groups hourly, daily and Monday-based weekly points without changing totals', () => {
    const monday = new Date(2026, 9, 19, 0, 0, 0).getTime() / 1000
    const input = [
      { ...row, created_at: monday + 3600 },
      { ...row, id: 2, created_at: monday + 2 * 86400 + 3600 },
    ]
    const hourly = aggregateUsage(input, monday, monday + 3 * 86400, 'hour')
    const daily = aggregateUsage(input, monday, monday + 3 * 86400, 'day')
    const weekly = aggregateUsage(input, monday, monday + 3 * 86400, 'week')
    expect(hourly.days).toHaveLength(73)
    expect(hourly.days.filter((point) => point.requests > 0)).toHaveLength(2)
    expect(daily.days.filter((point) => point.requests > 0)).toHaveLength(2)
    expect(weekly.days).toHaveLength(1)
    expect(weekly.days[0].requests).toBe(4)
    expect(hourly.totals).toEqual(daily.totals)
    expect(daily.totals).toEqual(weekly.totals)
  })
})

describe('analytics preferences', () => {
  it('retains session filters per account and round-trips local date inputs', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
    vi.stubGlobal('sessionStorage', storage)
    try {
      const session = { range: { start, end: start + 86400 }, username: 'alice' }
      saveAnalyticsSession(1, session)
      expect(loadAnalyticsSession(storage, 1)).toEqual(session)
      expect(loadAnalyticsSession(storage, 2)).toEqual({ range: null, username: '' })
      expect(new Date(localDateTimeInput(start)).getTime() / 1000).toBe(start)
      values.set('eva:analytics-session:2', '{"range":{"start":1,"end":99999999999999}}')
      expect(loadAnalyticsSession(storage, 2).range).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('keeps analytics preferences separate for each account', () => {
    const legacy = JSON.stringify({ defaultTimeRangeDays: 14, defaultTimeGranularity: 'week' })
    const values = new Map([['dashboard_models_chart_preferences', legacy]])
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
    vi.stubGlobal('localStorage', storage)
    try {
      expect(loadAnalyticsPreferences(storage, 1)).toEqual({ days: 7, granularity: null })
      saveAnalyticsPreferences(1, { days: 30, granularity: 'hour' })
      expect(loadAnalyticsPreferences(storage, 1)).toEqual({ days: 30, granularity: 'hour' })
      expect(loadAnalyticsPreferences(storage, 2)).toEqual({ days: 7, granularity: null })
      expect(values.get('dashboard_models_chart_preferences')).toBe(legacy)
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('uses site defaults when no valid saved choices exist', () => {
    const storage = { getItem: () => null }
    expect(loadAnalyticsPreferences(storage, 1)).toEqual({ days: 7, granularity: null })
  })
})

describe('ranking history', () => {
  it('keeps model buckets and series separate without synthesizing missing days', () => {
    const history = rankingHistory(
      {
        models: [{ name: 'a', vendor: 'A', total: 15 }],
        buckets: 2,
        points: [
          { ts: '2026-10-26', label: '26', model: 'a', vendor: 'A', tokens: 10 },
          { ts: '2026-10-24', label: '24', model: 'b', vendor: 'B', tokens: 7 },
          { ts: '2026-10-26', label: '26', model: 'a', vendor: 'A', tokens: 5 },
        ],
      },
      false
    )
    expect(history.series).toEqual(['a', 'b'])
    expect(history.buckets.map((bucket) => bucket.label)).toEqual(['24', '26'])
    expect(history.buckets[1].values.a).toEqual({ value: 15, tokens: 15 })
    expect(history.buckets[0].values.a).toBeUndefined()
  })
  it('retains native provider shares and zero usage rather than normalizing visible series', () => {
    const history = rankingHistory(
      {
        vendors: [{ name: 'A', total: 60, share: 0.6 }],
        buckets: 1,
        points: [
          { ts: '2026-10-26', label: '26', vendor: 'A', share: 0.6, tokens: 60 },
          { ts: '2026-10-26', label: '26', vendor: 'B', share: 0.4, tokens: 40 },
          { ts: '2026-10-26', label: '26', vendor: 'idle', share: 0, tokens: 0 },
        ],
      },
      true
    )
    expect(history.buckets[0].values.A).toEqual({ value: 0.6, tokens: 60 })
    expect(history.buckets[0].values.idle).toEqual({ value: 0, tokens: 0 })
  })
  it('returns an empty chart for an empty native history', () => {
    expect(rankingHistory({ points: [], models: [], buckets: 0 }, false)).toEqual({ series: [], buckets: [] })
  })
})
