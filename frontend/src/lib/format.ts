'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import { toIntlLocale } from '@/i18n/languages'
import { createCurrencyFormatter, parseCurrencyDisplayType } from './currency'
import type { CurrencyFormatOptions } from './currency'

// Uses New API quota-per-unit and display currency semantics. No billing is calculated here.
export function useCurrencyFormatter() {
  const { i18n } = useTranslation()
  const query = useQuery({
    queryKey: ['status'],
    queryFn: () =>
      api<{
        quota_per_unit: number
        quota_display_type?: string
        usd_exchange_rate?: number
        custom_currency_symbol?: string
        custom_currency_exchange_rate?: number
      }>('/api/status'),
    staleTime: 300_000,
  })
  const status = query.data
  const formatter = useMemo(
    () =>
      createCurrencyFormatter({
        displayInCurrency: status?.quota_display_type !== 'TOKENS',
        quotaDisplayType: parseCurrencyDisplayType(status?.quota_display_type),
        quotaPerUnit: status?.quota_per_unit || 500000,
        usdExchangeRate: status?.usd_exchange_rate || 1,
        customCurrencySymbol: status?.custom_currency_symbol || '¤',
        customCurrencyExchangeRate: status?.custom_currency_exchange_rate || 1,
      }),
    [status]
  )
  return { formatter, ready: !!status?.quota_per_unit, locale: toIntlLocale(i18n.language) }
}
export function useQuotaFormatter() {
  const { formatter, ready, locale } = useCurrencyFormatter()
  return (quota: number, options?: CurrencyFormatOptions) => (ready ? formatter.formatQuotaWithCurrency(quota, { ...options, locale }) : '—')
}
export function dateTime(timestamp: number) {
  return timestamp === -1 ? '—' : new Date(timestamp * 1000).toLocaleString('zh-CN', { hour12: false })
}

export { formatNumber, formatCompactNumber } from './number-format'
