import type { QuotaData } from '@/lib/api/types'

/** The usage API stores hour buckets; include this hour and the preceding 23. */
export function recentUsageWindow(now: number) {
  const currentHour = Math.floor(now / 3600) * 3600
  return { start: currentHour - 23 * 3600, end: now }
}

export type UsageTotals = { requests: number; tokens: number; quota: number; cacheRead: number; cacheCreation: number }
export type ModelUsage = UsageTotals & { model: string }
export type UsageDay = UsageTotals & { key: string; timestamp: number }
export type UsageGranularity = 'hour' | 'day' | 'week'
export type UserUsageRow = { username: string; count: number; quota: number; token_used: number; created_at?: number }

export function aggregateUserUsage(rows: UserUsageRow[], username = '') {
  const users = new Map<string, { username: string; requests: number; tokens: number; quota: number }>()
  for (const row of rows) {
    if (username && row.username !== username) continue
    let user = users.get(row.username)
    if (!user) {
      user = { username: row.username, requests: 0, tokens: 0, quota: 0 }
      users.set(row.username, user)
    }
    user.requests += row.count
    user.tokens += row.token_used
    user.quota += row.quota
  }
  return [...users.values()].sort((a, b) => b.quota - a.quota)
}

function bucketStart(timestamp: number, granularity: UsageGranularity) {
  if (granularity === 'hour') return Math.floor(timestamp / 3600) * 3600
  const date = new Date(timestamp * 1000)
  date.setHours(0, 0, 0, 0)
  if (granularity === 'week') date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date.getTime() / 1000
}

export function trendPosition(timestamps: number[], index: number) {
  if (timestamps.length <= 1) return 400
  return 64 + ((timestamps[index] - timestamps[0]) / (timestamps[timestamps.length - 1] - timestamps[0])) * 712
}

export function nearestTrendIndex(timestamps: number[], position: number) {
  let nearest = 0
  for (let index = 1; index < timestamps.length; index++) {
    if (Math.abs(trendPosition(timestamps, index) - position) < Math.abs(trendPosition(timestamps, nearest) - position)) nearest = index
  }
  return nearest
}

export function userUsageHistory(
  rows: UserUsageRow[],
  granularity: UsageGranularity,
  limit: number,
  username = '',
  metric: 'quota' | 'requests' | 'tokens' = 'quota'
) {
  const filtered = rows.filter((row) => !username || row.username === username)
  const users = aggregateUserUsage(filtered)
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, limit)
  const included = new Set(users.map((user) => user.username))
  const buckets = new Map<number, Map<string, number>>()
  for (const row of filtered) {
    if (row.created_at === undefined) continue
    const time = bucketStart(row.created_at, granularity)
    let values = buckets.get(time)
    if (!values) {
      values = new Map()
      buckets.set(time, values)
    }
    const value = metric === 'requests' ? row.count : metric === 'tokens' ? row.token_used : row.quota
    if (included.has(row.username)) values.set(row.username, (values.get(row.username) || 0) + value)
  }
  return { users, buckets: [...buckets].sort(([a], [b]) => a - b).map(([timestamp, values]) => ({ timestamp, values })) }
}

export function aggregateUsage(rows: QuotaData[], start: number, end: number, granularity: UsageGranularity = 'day') {
  const totals: UsageTotals = { requests: 0, tokens: 0, quota: 0, cacheRead: 0, cacheCreation: 0 }
  const models = new Map<string, ModelUsage>()
  const days = new Map<string, UsageDay>()
  for (let timestamp = bucketStart(start, granularity); timestamp <= end; ) {
    const key = String(timestamp)
    days.set(key, { key, timestamp, requests: 0, tokens: 0, quota: 0, cacheRead: 0, cacheCreation: 0 })
    if (granularity === 'hour') timestamp += 3600
    else {
      const next = new Date(timestamp * 1000)
      next.setDate(next.getDate() + (granularity === 'week' ? 7 : 1))
      timestamp = next.getTime() / 1000
    }
  }
  for (const row of rows) {
    if (row.created_at < start || row.created_at > end) continue
    const day = days.get(String(bucketStart(row.created_at, granularity)))
    let model = models.get(row.model_name)
    if (!model) {
      model = { model: row.model_name, requests: 0, tokens: 0, quota: 0, cacheRead: 0, cacheCreation: 0 }
      models.set(row.model_name, model)
    }
    for (const item of [totals, model, day]) {
      if (!item) continue
      item.requests += row.count
      item.tokens += row.token_used
      item.quota += row.quota
      item.cacheRead += row.cache_read_tokens || 0
      item.cacheCreation += row.cache_creation_tokens || 0
    }
  }
  return { totals, models: [...models.values()].sort((a, b) => b.quota - a.quota), days: [...days.values()] }
}

export function selectableUsageDays(maxDays: number, selected?: number) {
  const limit = Math.max(1, Math.floor(maxDays))
  return [...new Set([1, 7, 14, 29, 30, ...(limit < 30 ? [limit] : []), ...(selected ? [selected] : [])].filter((value) => value <= limit))].sort(
    (a, b) => a - b
  )
}

export function parseCustomUsageRange(start: string, end: string, maxDays: number) {
  const from = Math.floor(new Date(start).getTime() / 1000),
    to = Math.floor(new Date(end).getTime() / 1000)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= from) return { error: 'Invalid time range' as const }
  if (to - from > maxDays * 86400) return { error: 'The time range cannot exceed {{days}} days' as const }
  return { range: { start: from, end: to } }
}

export function usageRange(days: number, maxDays = 365) {
  const end = Math.floor(Date.now() / 1000)
  const start = new Date(end * 1000)
  start.setDate(start.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)
  return { start: Math.max(Math.floor(start.getTime() / 1000), end - Math.max(1, maxDays) * 86400), end }
}

export function refreshAnalytics(customRange: boolean, end: number, now: number, refetch: () => void, advance: () => void) {
  if (customRange || end === now) refetch()
  else advance()
}
