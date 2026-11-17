import { describe, expect, it } from 'vitest'
import { createCurrencyFormatter, DEFAULT_CURRENCY_CONFIG } from '../currency'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatCompactNumber } from '../number-format'
import { dateTime } from '../format'

describe('native currency behavior in the Next frontend', () => {
  it.each([
    ['zhCN', '$0.00025'],
    ['zhTW', '$0.00025'],
    ['en', '$0.00025'],
    ['fr', '0,00025 $'],
    ['ja', '$0.00025'],
    ['ru', '0,00025 $'],
    ['vi', '0,00025 $'],
    ['invalid', '$0.00025'],
  ])('preserves six-decimal REST prices for %s', (language, expected) => {
    const formatter = createCurrencyFormatter(DEFAULT_CURRENCY_CONFIG)
    expect(formatter.formatQuotaWithCurrency(125, { digitsSmall: 6, digitsLarge: 6, locale: toIntlLocale(language) })).toBe(expected)
  })
  it('converts quota to the configured display currency once', () => {
    const formatter = createCurrencyFormatter({ ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'CNY', usdExchangeRate: 7 })
    expect(formatter.formatQuotaWithCurrency(500000, { locale: 'en-US' })).toBe('¥7')
    expect(formatter.formatLocalCurrencyAmount(7, { locale: 'en-US' })).toBe('¥7')
  })
  it('keeps token balances distinct from monetary billing values', () => {
    const formatter = createCurrencyFormatter({ ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'TOKENS' })
    expect(formatter.formatQuotaWithCurrency(500000, { abbreviate: false })).toBe('500000')
    expect(formatter.formatBillingCurrencyFromUSD(1, { locale: 'en-US' })).toBe('$1')
  })
  it('uses the configured custom currency and native locale aliases', () => {
    const formatter = createCurrencyFormatter({
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CUSTOM',
      customCurrencySymbol: 'CR',
      customCurrencyExchangeRate: 10,
    })
    expect(formatter.formatQuotaWithCurrency(500000, { locale: 'en-US' })).toBe('CR 10')
    expect(toIntlLocale('zhCN')).toBe('zh-CN')
    expect(toIntlLocale('zhTW')).toBe('zh-TW')
  })
})

describe('shared number display', () => {
  it.each([
    ['zhCN', '12,345.68', '1.2万'],
    ['zhTW', '12,345.68', '1.2萬'],
    ['en', '12,345.68', '12.3K'],
    ['fr', '12 345,68', '12,3 k'],
    ['ja', '12,345.68', '1.2万'],
    ['ru', '12 345,68', '12,3 тыс.'],
    ['vi', '12.345,68', '12,3 N'],
  ])('preserves ordinary and compact precision for %s', (language, number, compact) => {
    const locale = toIntlLocale(language)
    expect(formatNumber(12345.678, locale)).toBe(number)
    expect(formatCompactNumber(12345.678, locale)).toBe(compact)
  })
  it('falls back to the runtime locale for an invalid language tag', () => {
    const locale = toIntlLocale('bad_!')
    expect(locale).toBeUndefined()
    expect(formatCompactNumber(12345.678, locale)).toBe(formatCompactNumber(12345.678))
    expect(formatNumber(12345.678, locale)).toBe(formatNumber(12345.678))
  })
  it('distinguishes absent values from explicit zero', () => {
    expect(formatNumber(null, 'en')).toBe('-')
    expect(formatCompactNumber(NaN, 'en')).toBe('-')
    expect(formatNumber(0, 'en')).toBe('0')
  })
  it('formats timestamps with explicit locale instead of hardcoding zh-CN', () => {
    expect(dateTime(-1, 'en')).toBe('—')
    expect(dateTime(1700000000, 'en')).toBe(new Date(1700000000 * 1000).toLocaleString('en-US', { hour12: false }))
    expect(dateTime(1700000000, 'zhCN')).toBe(new Date(1700000000 * 1000).toLocaleString('zh-CN', { hour12: false }))
  })
})
