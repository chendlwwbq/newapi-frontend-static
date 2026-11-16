import type { Token } from '@/lib/api/types'
import { createCurrencyFormatter, parseCurrencyDisplayType } from '@/lib/currency'

export type QuotaStatus = {
  quota_per_unit: number
  quota_display_type?: string
  usd_exchange_rate?: number
  custom_currency_symbol?: string
  custom_currency_exchange_rate?: number
  default_use_auto_group?: boolean
}
export function quotaInput(status: QuotaStatus) {
  const formatter = createCurrencyFormatter({
    quotaPerUnit: status.quota_per_unit,
    quotaDisplayType: parseCurrencyDisplayType(status.quota_display_type),
    displayInCurrency: status.quota_display_type !== 'TOKENS',
    usdExchangeRate: status.usd_exchange_rate || 1,
    customCurrencySymbol: status.custom_currency_symbol || '¤',
    customCurrencyExchangeRate: status.custom_currency_exchange_rate || 1,
  })
  const { config, meta } = formatter.getCurrencyDisplay()
  const scale = meta.kind === 'tokens' ? 1 : config.quotaPerUnit / meta.exchangeRate
  return {
    label: formatter.getCurrencyLabel(),
    scale,
    toDisplay: (quota: number) => quota / scale,
    toQuota: (amount: number) => {
      const result = Math.round(amount * scale)
      if (!Number.isSafeInteger(result) || result < 0) throw new Error('Invalid parameters')
      return result
    },
  }
}
export function newToken(status: QuotaStatus, group?: string): Partial<Token> {
  const chosen = group ?? (status.default_use_auto_group ? 'auto' : 'default')
  return {
    name: '',
    group: chosen,
    unlimited_quota: true,
    remain_quota: 0,
    expired_time: -1,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
    cross_group_retry: chosen === 'auto',
    auto_groups: [],
    allow_user_quota_query: true,
    status: 1,
  }
}
/** Allow an existing key to retain its old group while preventing a new invalid selection. */
export function tokenGroupSelectable(group: string, groups: Record<string, unknown> | undefined, original?: string) {
  if (!groups) return false
  return Object.hasOwn(groups, group) || (original !== undefined && group === original)
}
export function tokenPayload(token: Partial<Token>): Partial<Token> {
  return {
    id: token.id,
    name: token.name,
    status: token.status,
    remain_quota: token.remain_quota ?? 0,
    unlimited_quota: !!token.unlimited_quota,
    expired_time: token.expired_time ?? -1,
    model_limits_enabled: !!token.model_limits_enabled,
    model_limits: token.model_limits || '',
    allow_ips: token.allow_ips || '',
    group: token.group || '',
    cross_group_retry: token.group === 'auto' && !!token.cross_group_retry,
    auto_groups: token.group === 'auto' ? (token.auto_groups ?? []) : [],
    allow_user_quota_query: token.allow_user_quota_query,
  }
}
export function tokenStatus(token: Token, now = Math.floor(Date.now() / 1000)) {
  if (token.status === 2) return 'Disabled'
  if (token.status === 3 || (token.expired_time !== -1 && token.expired_time <= now)) return 'Expired'
  if (token.status === 4 || (!token.unlimited_quota && token.remain_quota <= 0)) return 'Exhausted'
  return 'Enabled'
}
