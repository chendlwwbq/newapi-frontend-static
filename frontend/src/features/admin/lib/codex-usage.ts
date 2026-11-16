export interface CodexWindow {
  used_percent?: number | null
  reset_at?: number | null
  reset_after_seconds?: number | null
  limit_window_seconds?: number | null
}
export interface CodexRateLimit {
  plan_type?: string
  allowed?: boolean
  limit_reached?: boolean
  primary_window?: CodexWindow | null
  secondary_window?: CodexWindow | null
}
export interface CodexUsage {
  plan_type?: string
  email?: string
  user_id?: string
  rate_limit?: CodexRateLimit
  additional_rate_limits?: Array<{
    limit_name?: string
    metered_feature?: string
    rate_limit?: CodexRateLimit
    primary_window?: CodexWindow
    secondary_window?: CodexWindow
    plan_type?: string
  }>
  rate_limit_reset_credits?: { available_count?: number }
  credits?: { overage_limit_reached?: boolean }
  spend_control?: { reached?: boolean }
}
export interface CodexResetCredit {
  id?: string
  status?: string
  reset_type?: string
  title?: string
  description?: string
  granted_at?: string | number | null
  expires_at?: string | number | null
  redeem_started_at?: string | number | null
  redeemed_at?: string | number | null
}
export interface CodexResetCredits {
  credits?: CodexResetCredit[]
  available_count?: number
  total_earned_count?: number
}

/** Native accounts may return windows in either order; free accounts have one weekly window. */
export function codexWindows(source: { plan_type?: string; rate_limit?: CodexRateLimit } | undefined) {
  const rate = source?.rate_limit
  const primary = rate?.primary_window ?? null,
    secondary = rate?.secondary_window ?? null
  const windows = [primary, secondary].filter((window): window is CodexWindow => !!window)
  let fiveHour: CodexWindow | null = null,
    weekly: CodexWindow | null = null
  for (const window of windows) {
    const duration = window.limit_window_seconds
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) continue
    if (duration >= 86400 && !weekly) weekly = window
    if (duration < 86400 && !fiveHour) fiveHour = window
  }
  if ((source?.plan_type ?? rate?.plan_type)?.trim().toLowerCase() === 'free') return { fiveHour: null, weekly: weekly ?? primary ?? secondary }
  if (!fiveHour && !weekly) return { fiveHour: primary, weekly: secondary }
  if (!fiveHour) fiveHour = windows.find((window) => window !== weekly) ?? null
  if (!weekly) weekly = windows.find((window) => window !== fiveHour) ?? null
  return { fiveHour, weekly }
}

export function codexUsedPercent(window: CodexWindow | null | undefined): number | undefined {
  const value = window?.used_percent
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(100, Math.max(0, value))
}

export function codexResetAvailable(credits: CodexResetCredits | undefined, usage: CodexUsage | undefined): number | undefined {
  const value = credits?.available_count ?? usage?.rate_limit_reset_credits?.available_count
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined
  return value
}

export function codexCreditTimestamp(value: string | number | null | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const timestamp = typeof value === 'number' ? value * 1000 : Date.parse(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined
}
