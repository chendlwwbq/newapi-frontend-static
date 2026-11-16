import { legacyPriceRows } from './legacy-prices'
import { describe, expect, it } from 'vitest'
import { syncPricingChange, validateGroupSetting, type Snapshot } from './contracts'
import {
  pricingExpressionParts,
  combinePricingDraft,
  taskVisualDraft,
  setVisualImageCount,
  requestRulesDraft,
  parseRequestRulesDraft,
} from './visual-draft'
import { buildRequestRuleExpr, tryParseRequestRuleExpr, createEmptyCondition } from '@/features/pricing/lib/billing-expr'
import { parseVisualBillingDocument, serializeVisualBillingDocument } from '@/features/pricing/lib/billing-expression/visual'
import { compileBillingExpression } from '@/features/pricing/lib/billing-expression/parser'
import { generateTaskExprFromConfig } from '@/features/pricing/lib/task-expr'
import { adjustSyncPrice } from './price-adjustment'

const snapshot: Snapshot = {
  empty_version: 'empty',
  entries: [
    {
      model_name: 'fixture',
      version: 'one',
      effective: {},
      configured: { ModelRatio: 5, 'billing_setting.plugin_billing_expr': { provider: 'tier("base", u("seconds") * 1)' } },
    },
  ],
}
describe('request multiplier editing', () => {
  it('refuses an incomplete condition instead of dropping it from an AND group', () => {
    expect(
      requestRulesDraft([{ multiplier: '2', conditions: [{ ...createEmptyCondition(), path: 'mode', value: 'fast' }, createEmptyCondition()] }]).ok
    ).toBe(false)
  })
  it('retains zero multipliers and rejects negative or non-finite multipliers', () => {
    const conditions = [{ ...createEmptyCondition(), path: 'mode', value: 'fast' }]
    expect(requestRulesDraft([{ multiplier: '0', conditions }]).ok).toBe(true)
    for (const multiplier of ['', '-1', 'Infinity']) expect(requestRulesDraft([{ multiplier, conditions }]).ok).toBe(false)
  })
  it('retains equality string literals that look like numbers or booleans', () => {
    for (const value of ['true', 'false', '12', '  fast  ']) {
      const source = `(param("mode") == ${JSON.stringify(value)} ? 2 : 1)`
      const groups = tryParseRequestRuleExpr(source)!
      expect(buildRequestRuleExpr(groups)).toBe(source)
    }
  })
  it('rejects invalid timezones and empty rule conditions', () => {
    expect(requestRulesDraft([{ multiplier: '2', conditions: [] }]).ok).toBe(false)
    expect(
      requestRulesDraft([
        {
          multiplier: '2',
          conditions: [{ source: 'time', timeFunc: 'hour', timezone: 'invalid/timezone', mode: 'gte', value: '10', rangeStart: '', rangeEnd: '' }],
        },
      ]).ok
    ).toBe(false)
  })
  it('round trips an overnight time range and request condition together', () => {
    const source = '((hour("UTC") >= 21 || hour("UTC") < 6) && param("mode") == "fast" ? 0.5 : 1)'
    const groups = tryParseRequestRuleExpr(source)!
    expect(requestRulesDraft(groups).ok).toBe(true)
    expect(buildRequestRuleExpr(groups)).toBe(source)
  })
  it('leaves an escaped path in raw mode when the parser cannot round trip it', () => {
    expect(parseRequestRulesDraft('(param("mode\\\\path") == "fast" ? 2 : 1)')).toBeNull()
    expect(parseRequestRulesDraft('(param("mode") == "true" ? 2 : 1)')).not.toBeNull()
  })
})
describe('pricing drafts and native imports', () => {
  it('retains source formatting and optional zero-price variables when one price changes', () => {
    const source = 'v1:len <= 128000 ? tier("short", p * 2 + c * 4 + cr * 0) : tier("long", p * 4 + c * 8)'
    const document = parseVisualBillingDocument(source)!
    expect(serializeVisualBillingDocument(document)).toEqual({ ok: true, source })
    if (document.root.kind !== 'branch' || document.root.yes.kind !== 'tier') throw new Error('wrong branch')
    document.root.yes.prices[0].value = '3'
    expect(serializeVisualBillingDocument(document)).toEqual({ ok: true, source: source.replace('p * 2', 'p * 3') })
  })
  it('refuses incomplete visual prices rather than turning blanks into zero', () => {
    const document = parseVisualBillingDocument('tier("base", p * 2)')!
    if (document.root.kind !== 'tier') throw new Error('wrong branch')
    document.root.prices[0].value = ''
    expect(serializeVisualBillingDocument(document).ok).toBe(false)
  })
  it('keeps expression version outside request rule parentheses', () => {
    const previous = 'v1:(tier("base", p * 2 + c * 4)) * (header("x-plan") == "fast" ? 2 : 1)'
    const parts = pricingExpressionParts(previous)
    expect(parts.prefix).toBe('v1:')
    expect(parts.requestRuleExpr).toContain('header')
    const next = combinePricingDraft(parts.billingExpr.replace('p * 2', 'p * 3'), previous)
    expect(next.startsWith('v1:')).toBe(true)
    expect(compileBillingExpression(next).status).toBe('ready')
    expect(next).toContain('header("x-plan") == "fast" ? 2 : 1')
  })
  it('supports fixed request prices and reversible image quantity opt-in', () => {
    const original = parseVisualBillingDocument('v1:tier("request", fixed(0))')!
    const counted = setVisualImageCount(original, true)!
    expect(counted.imageCount).toBe(true)
    const reset = setVisualImageCount(counted, false)!
    expect(reset.imageCount).toBe(false)
    expect(serializeVisualBillingDocument(reset).ok).toBe(true)
  })
  it('keeps custom or invalid expressions in raw mode', () => {
    expect(parseVisualBillingDocument('tier("base", max(p, 10) * 3)')).toBeNull()
    expect(parseVisualBillingDocument('tier("base", fixed(1) + p * 2)')).toBeNull()
  })
  it('does not introduce image quantity multiplication into token pricing', () => {
    expect(setVisualImageCount(parseVisualBillingDocument('tier("base", p * 2 + c * 4)')!, true)).toBeNull()
  })
  it('preserves task token scale and enum tier conditions', () => {
    const schema = { tokens: { type: 'number' as const, unit: 'token' as const }, mode: { enum: ['pro', 'std'] } }
    const source = 'u("mode") == "pro" ? tier("pro", u("tokens") * 9.8 / 1000000) : tier("std", u("tokens") * 0 / 1000000)'
    const draft = taskVisualDraft(source, schema)!
    expect(draft.tiers[0].unitPrices.tokens).toBe(9.8)
    expect(generateTaskExprFromConfig(draft, schema)).toBe(source)
    expect(taskVisualDraft(source, { tokens: schema.tokens })).toBeNull()
  })
  it('syncs exact expressions and keeps target provider overrides', () => {
    const source = 'v1:tier("base", p * 0 + c * 3)'
    expect(syncPricingChange(snapshot, 'fixture', { billing_mode: 'tiered_expr', billing_expr: source })).toEqual({
      model_name: 'fixture',
      expected_version: 'one',
      pricing: {
        'billing_setting.billing_mode': 'tiered_expr',
        'billing_setting.billing_expr': source,
        'billing_setting.plugin_billing_expr': snapshot.entries[0].configured['billing_setting.plugin_billing_expr'],
      },
    })
  })
  it('keeps each group price when importing another model price', () => {
    const groupPrices = { special: 'tier("base", p * 2)', stable: 'tier("base", p * 4)' }
    const withGroups = {
      ...snapshot,
      entries: [{ ...snapshot.entries[0], configured: { ...snapshot.entries[0].configured, 'billing_setting.group_billing_expr': groupPrices } }],
    }
    expect(syncPricingChange(withGroups, 'fixture', { model_ratio: 1 }).pricing['billing_setting.group_billing_expr']).toEqual(groupPrices)
  })
  it('a free per-request import replaces legacy ratios and uses the empty version for new models', () => {
    expect(syncPricingChange(snapshot, 'new', { model_price: 0, model_ratio: 5, completion_ratio: 2 })).toEqual({
      model_name: 'new',
      expected_version: 'empty',
      pricing: { 'billing_setting.billing_mode': 'ratio', ModelPrice: 0 },
    })
  })
  it('retains free output multipliers and rejects invalid source prices', () => {
    expect(syncPricingChange(snapshot, 'fixture', { model_ratio: 1, completion_ratio: 0 }).pricing.CompletionRatio).toBe(0)
    expect(() => syncPricingChange(snapshot, 'new', { model_ratio: -1 })).toThrow()
    expect(() => syncPricingChange(snapshot, 'new', {})).toThrow()
  })
  it('adjusts absolute prices once while retaining conditions, zero prices and request multipliers', () => {
    const source = {
      billing_mode: 'tiered_expr',
      billing_expr: 'v1:(len <= 100 ? tier("short", p * 2 + cr * 0) : tier("long", fixed(0.02))) * (header("x-fast") == "yes" ? 2 : 1)',
    }
    const result = adjustSyncPrice(source, 'multiply', 3)
    expect(result.error).toBeUndefined()
    expect(result.values?.billing_expr).toContain('p * 6 + cr * 0')
    expect(result.values?.billing_expr).toContain('fixed(0.06)')
    expect(result.values?.billing_expr).toContain('header("x-fast") == "yes" ? 2 : 1')
    expect(source.billing_expr).toContain('p * 2')
  })
  it('does not guess how to scale custom expressions or use a zero exchange factor', () => {
    expect(adjustSyncPrice({ billing_mode: 'tiered_expr', billing_expr: 'tier("base", max(p, 1) * 2)' }, 'multiply', 3).error).toBeTruthy()
    expect(adjustSyncPrice({ model_ratio: 1 }, 'divide', 0).error).toBeTruthy()
  })
})
describe('group settings shape and numeric boundaries', () => {
  it('preserves decimal and explicit zero group and top-up ratios', () => {
    expect(validateGroupSetting('GroupRatio', '{"default":0,"vip":0.3}')).toBe('{"default":0,"vip":0.3}')
    expect(validateGroupSetting('TopupGroupRatio', '{"default":1.25}')).toContain('1.25')
    expect(validateGroupSetting('GroupGroupRatio', '{"vip":{"default":0}}')).toContain(':0')
  })
  it('supports visibility add/remove keys and routing order', () => {
    expect(validateGroupSetting('group_ratio_setting.group_special_usable_group', '{"vip":{"+:pro":"Pro","-:default":"remove"}}')).toContain(
      '-:default'
    )
    expect(validateGroupSetting('AutoGroups', '["vip","default"]')).toBe('["vip","default"]')
    expect(validateGroupSetting('AutoGroups', '[]')).toBe('[]')
  })
  it.each([
    ['GroupRatio', '{"default":-1}'],
    ['GroupGroupRatio', '{"vip":null}'],
    ['UserUsableGroups', '{"vip":1}'],
    ['AutoGroups', '["vip","vip"]'],
    ['AutoGroups', '[""]'],
    ['MaxTokenAutoGroups', '0'],
    ['MaxTokenAutoGroups', '1.5'],
  ])('rejects invalid %s without coercion', (key, value) => {
    expect(() => validateGroupSetting(key, value)).toThrow()
  })
})

describe('legacy effective price presentation', () => {
  it('uses the native quota unit and preserves free cache prices', () => {
    expect(
      legacyPriceRows({ effective: { ModelRatio: 1.5, CompletionRatio: 2, CacheRatio: 0, CreateCacheRatio: 1.25 }, cache_write_mode: 'none' }, 250000)
    ).toEqual([
      { label: 'Input', amount: 6, unit: 'token' },
      { label: 'Output', amount: 12, unit: 'token' },
      { label: 'Cache read', amount: 0, unit: 'token' },
    ])
  })
  it('distinguishes Claude and OpenAI TTL write prices', () => {
    const effective = { ModelRatio: 1.5, CreateCacheRatio: 1.25 }
    expect(legacyPriceRows({ effective, cache_write_mode: 'claude_ttl' }, 500000).slice(-2)).toEqual([
      { label: 'Cache write (5 minutes)', amount: 3.75, unit: 'token' },
      { label: 'Cache write (1 hour)', amount: 6, unit: 'token' },
    ])
    expect(legacyPriceRows({ effective, cache_write_mode: 'openai_ttl' }, 500000).slice(-2)).toEqual([
      { label: 'Cache write (30 minutes)', amount: 3.75, unit: 'token' },
      { label: 'Cache write (12 hours)', amount: 7.5, unit: 'token' },
    ])
  })
  it('uses absolute native audio prices even with free or absent text pricing', () => {
    expect(legacyPriceRows({ effective: { ModelRatio: 0 }, billing_details: { audio_input_price: 12, audio_output_price: 0 } }, 500000)).toEqual([
      { label: 'Input', amount: 0, unit: 'token' },
      { label: 'Audio input', amount: 12, unit: 'token' },
      { label: 'Audio output', amount: 0, unit: 'token' },
    ])
    expect(legacyPriceRows({ effective: {}, billing_details: { audio_input_price: 12 } })).toEqual([
      { label: 'Audio input', amount: 12, unit: 'token' },
    ])
  })
  it('keeps fixed zero prices and never invents a legacy price for expressions or unknown quota units', () => {
    expect(legacyPriceRows({ effective: { ModelPrice: 0 } })).toEqual([{ label: 'Per request', amount: 0, unit: 'request' }])
    expect(legacyPriceRows({ effective: { ModelRatio: 2 } })).toEqual([])
    expect(legacyPriceRows({ effective: { ModelPrice: 3, 'billing_setting.billing_mode': 'tiered_expr' } })).toEqual([])
  })
})
