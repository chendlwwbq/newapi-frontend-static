import { describe, expect, it } from 'vitest'
import { validateSettingsCollection, validateSettingsUrl } from './settings-collections'
import { settingsSections } from '../settings-schema'
import { prepareOptionChanges, projectOptionValues } from './settings-options'

const initial = (section: string) => Object.fromEntries(settingsSections[section].fields.map((field) => [field.key, field.defaultValue ?? '']))
describe('payment, quota and console settings', () => {
  it('projects only non-secret payment metadata', () => {
    const keys = [
      'EpayKey',
      'StripeApiSecret',
      'StripeWebhookSecret',
      'CreemApiKey',
      'WaffoPrivateKey',
      'WaffoSandboxApiKey',
      'WaffoPancakePrivateKey',
      'payment_setting.compliance_confirmed_ip',
      'WaffoPancakeMerchantID',
      'payment_setting.compliance_terms_version',
    ]
    expect(
      projectOptionValues(
        keys.map((key) => ({ key, value: 'fixture' })),
        settingsSections
      )
    ).toEqual({ WaffoPancakeMerchantID: 'fixture', 'payment_setting.compliance_terms_version': 'fixture' })
  })
  it('retains unknown record properties and sends discounts as an object', () => {
    const baseline = initial('payment'),
      methods = [{ name: 'Card', type: 'custom', vendor: { retained: true } }]
    const result = prepareOptionChanges(
      settingsSections.payment,
      baseline,
      { ...baseline, PayMethods: JSON.stringify(methods), 'payment_setting.amount_discount': '{"10":0.9}' },
      new Set()
    )
    expect(result).toEqual([
      { key: 'PayMethods', value: JSON.stringify(methods) },
      { key: 'payment_setting.amount_discount', value: '{"10":0.9}' },
    ])
  })
  it.each([0, -1, 1.1, '0.9'])('rejects an invalid recharge discount %j', (discount) => {
    expect(() => validateSettingsCollection('payment_setting.amount_discount', { '10': discount })).toThrow()
  })
  it('validates the complete recharge list without dropping entries', () => {
    expect(() => validateSettingsCollection('payment_setting.amount_options', [1, 10, 100])).not.toThrow()
    for (const value of [
      [1, 1],
      [1, -1],
      [1, 1.5],
      [1, '2'],
    ])
      expect(() => validateSettingsCollection('payment_setting.amount_options', value)).toThrow()
  })
  it('preserves fractional reserves and zero thresholds while rejecting zero multipliers', () => {
    const baseline = initial('quota')
    expect(
      prepareOptionChanges(
        settingsSections.quota,
        baseline,
        { ...baseline, 'quota_setting.pre_consume_multiplier': '0.5', 'quota_setting.trust_quota_usd': '0' },
        new Set()
      )
    ).toEqual([
      { key: 'quota_setting.trust_quota_usd', value: 0 },
      { key: 'quota_setting.pre_consume_multiplier', value: 0.5 },
    ])
    for (const key of ['QuotaPerUnit', 'USDExchangeRate', 'quota_setting.pre_consume_multiplier', 'general_setting.custom_currency_exchange_rate'])
      expect(() => prepareOptionChanges(settingsSections.quota, baseline, { ...baseline, [key]: '0' }, new Set())).toThrow('Invalid numeric setting')
  })
  it('validates callback origins and rejects credentials and dangerous protocols', () => {
    expect(() => validateSettingsUrl('https://api.example.test', true)).not.toThrow()
    for (const value of [
      'https://api.example.test/path',
      'https://api.example.test?x=1',
      'https://api.example.test#x',
      'https://a:b@api.example.test',
      'javascript:alert(1)',
    ])
      expect(() => validateSettingsUrl(value, true)).toThrow()
  })
  it('validates announcement dates, lengths and whole rows', () => {
    expect(() =>
      validateSettingsCollection('console_setting.announcements', [{ content: 'Hello', publishDate: '2026-10-26T12:00:00+08:00', extension: 1 }])
    ).not.toThrow()
    for (const row of [
      { content: '', publishDate: '2026-10-26T00:00:00Z' },
      { content: 'Hello', publishDate: '2026-10-26' },
      { content: 'a'.repeat(501), publishDate: '2026-10-26T00:00:00Z' },
    ])
      expect(() => validateSettingsCollection('console_setting.announcements', [row])).toThrow()
  })
  it('rejects duplicate status categories, unsafe URLs and dangerous route content', () => {
    const row = { categoryName: 'Service', url: 'https://status.example.test', slug: 'eva', description: '' }
    expect(() => validateSettingsCollection('console_setting.uptime_kuma_groups', [row])).not.toThrow()
    expect(() => validateSettingsCollection('console_setting.uptime_kuma_groups', [row, row])).toThrow()
    expect(() =>
      validateSettingsCollection('console_setting.api_info', [{ url: 'javascript:alert(1)', route: 'main', description: 'API', color: 'blue' }])
    ).toThrow()
    expect(() =>
      validateSettingsCollection('console_setting.api_info', [{ url: 'https://example.test', route: '<script>', description: 'API', color: 'blue' }])
    ).toThrow()
  })
  it('saves content before enabling it and disables it before clearing it', () => {
    const baseline = initial('content'),
      faq = JSON.stringify([{ question: 'Q', answer: 'A' }])
    const changes = prepareOptionChanges(
      settingsSections.content,
      baseline,
      { ...baseline, 'console_setting.faq_enabled': 'true', 'console_setting.faq': faq },
      new Set()
    )
    expect(changes.map((change) => change.key)).toEqual(['console_setting.faq', 'console_setting.faq_enabled'])
    expect(
      prepareOptionChanges(
        settingsSections.content,
        { ...baseline, 'console_setting.faq_enabled': 'true' },
        { ...baseline, 'console_setting.faq_enabled': 'false', 'console_setting.faq': '[]' },
        new Set()
      ).map((change) => change.key)
    ).toEqual(['console_setting.faq_enabled', 'console_setting.faq'])
  })
  it('preserves payment secrets on unrelated writes and enables Waffo last', () => {
    const baseline = initial('payment')
    expect(
      prepareOptionChanges(settingsSections.payment, baseline, { ...baseline, WaffoEnabled: 'true', WaffoApiKey: 'fixture' }, new Set())
    ).toEqual([
      { key: 'WaffoApiKey', value: 'fixture' },
      { key: 'WaffoEnabled', value: true },
    ])
  })
  it('accepts the native card method with an empty optional provider name', () => {
    expect(() =>
      validateSettingsCollection('WaffoPayMethods', [
        { name: 'Card', icon: '/pay-card.png', payMethodType: 'CREDITCARD,DEBITCARD', payMethodName: '' },
      ])
    ).not.toThrow()
  })
})
