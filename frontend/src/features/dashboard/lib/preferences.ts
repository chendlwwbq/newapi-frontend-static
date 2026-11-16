import type { UsageGranularity } from './analytics'

export type AnalyticsPreferences = { days: number; granularity: UsageGranularity | null }
export type AnalyticsSession = { range: { start: number; end: number } | null; username: string }
const validDays = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 30
const isGranularity = (value: unknown): value is UsageGranularity => value === 'hour' || value === 'day' || value === 'week'
const key = (userId: number) => `eva:analytics:${userId}`

export function loadAnalyticsPreferences(storage: Pick<Storage, 'getItem'>, userId: number): AnalyticsPreferences {
  const defaults: AnalyticsPreferences = { days: 7, granularity: null }
  try {
    const saved = storage.getItem(key(userId))
    if (saved) {
      const value = JSON.parse(saved)
      return { days: validDays(value.days) ? value.days : 7, granularity: isGranularity(value.granularity) ? value.granularity : null }
    }
    return defaults
  } catch {
    return defaults
  }
}
export function saveAnalyticsPreferences(userId: number, preferences: AnalyticsPreferences) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(preferences))
  } catch {
    /* The controls remain usable for the current page. */
  }
}

export function loadAnalyticsSession(storage: Pick<Storage, 'getItem'>, userId: number): AnalyticsSession {
  try {
    const value = JSON.parse(storage.getItem(`eva:analytics-session:${userId}`) || 'null')
    const start = value?.range?.start,
      end = value?.range?.end
    const range = Number.isSafeInteger(start) && Number.isSafeInteger(end) && start > 0 && end > start && end <= 253402300799 ? { start, end } : null
    return { range, username: typeof value?.username === 'string' ? value.username : '' }
  } catch {
    return { range: null, username: '' }
  }
}
export function saveAnalyticsSession(userId: number, session: AnalyticsSession) {
  try {
    sessionStorage.setItem(`eva:analytics-session:${userId}`, JSON.stringify(session))
  } catch {
    /* The filters remain usable for the current page. */
  }
}

export function localDateTimeInput(timestamp: number) {
  const date = new Date(timestamp * 1000)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
