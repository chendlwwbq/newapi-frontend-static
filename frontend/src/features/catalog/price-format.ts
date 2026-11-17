import type { Quote } from '@/lib/api/types'
import { createCurrencyFormatter, DEFAULT_CURRENCY_CONFIG } from '@/lib/currency'
import type { BillingUsageFieldSchema } from '@/features/pricing/types'

export function usagePriceLabel(key: string, field: BillingUsageFieldSchema | undefined, language: string) {
  const description = field?.description
  if (typeof description === 'string') return description || key
  return description?.[language] || description?.[language.split('-')[0]] || description?.en || description?.zh || key
}

export function quoteUnitLabel(quote?: Quote) {
  if (quote?.billing_group_scoped) return quote.status === 'unconfigured' || !quote.billing_expr?.trim() ? 'Unconfigured' : 'See price details'
  if (!quote?.components.length) return 'See price details'
  if (quote.components.every((part) => part.unit === 'request')) return quote.pricing_source === 'plugin' ? 'Fixed (per video)' : 'Per request'
  if (quote.components.every((part) => part.unit === 'second')) return 'Per second'
  if (quote.components.every((part) => part.unit === 'token' && part.quantity === 1000000)) return 'Per million tokens'
  return 'See price details'
}
export function formatPrice(amount: number, currency: 'USD' | 'CNY', locale?: Intl.LocalesArgument) {
  return createCurrencyFormatter({ ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: currency }).formatLocalCurrencyAmount(amount, {
    locale,
    digitsLarge: 6,
    digitsSmall: 10,
    abbreviate: false,
  })
}
export const componentLabels: Record<string, string> = {
  input: 'Input',
  output: 'Output',
  request: 'Per request',
  cache_read: 'Cache read',
  cache_write: 'Cache write',
  cache_write_5m: 'Cache write (5 minutes)',
  cache_write_1h: 'Cache write (1 hour)',
  cache_write_30m: 'Cache write (30 minutes)',
  cache_write_12h: 'Cache write (12 hours)',
  gemini_audio_input: 'Native Gemini audio input',
  image_input: 'Image input',
  audio_input: 'Audio input',
  audio_output: 'Audio output',
}
