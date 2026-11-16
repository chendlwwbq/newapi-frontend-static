import { modelMappingRecord, parseModelSetting } from './model-settings-editor'
import { describe, expect, it } from 'vitest'
import { settingsSections } from '../settings-schema'
import { prepareOptionChanges } from './settings-options'
import { validateSettingsCollection } from './settings-collections'
import { parseHeaderNavModules, sidebarItemVisible, updateNavigationModule } from '@/components/layout/navigation-config'

describe('native model and rate-limit settings', () => {
  it('preserves Go regex model identifiers without interpreting them as JavaScript', () => {
    expect(() => validateSettingsCollection('global.thinking_model_blacklist', ['re:(?i)claude.*', 'exact-model'])).not.toThrow()
    expect(() => validateSettingsCollection('global.effort_tail_model_ids', [1])).toThrow()
  })
  it('accepts native zero default tokens and rejects lossy or negative counts', () => {
    expect(() => validateSettingsCollection('claude.default_max_tokens', { 'claude-fixture': 0 })).not.toThrow()
    for (const value of [-1, 1.5, '100']) expect(() => validateSettingsCollection('claude.default_max_tokens', { model: value })).toThrow()
  })
  it('requires native header arrays and rejects line injection', () => {
    expect(() => validateSettingsCollection('claude.model_headers_settings', { model: { 'anthropic-beta': ['test-flag'] } })).not.toThrow()
    for (const value of ['flag', ['flag\r\nx: other']])
      expect(() => validateSettingsCollection('claude.model_headers_settings', { model: { 'anthropic-beta': value } })).toThrow()
  })
  it('rejects malformed Gemini overrides', () => {
    expect(() => validateSettingsCollection('gemini.safety_settings', { model: 'BLOCK_NONE' })).not.toThrow()
    expect(() => validateSettingsCollection('gemini.safety_settings', { model: 'unknown' })).toThrow()
    expect(() => validateSettingsCollection('gemini.version_settings', { model: 123 })).toThrow()
    expect(() => validateSettingsCollection('gemini.supported_imagine_models', {})).toThrow()
  })
  it('checks conversion policy types while preserving native regex strings', () => {
    expect(() =>
      validateSettingsCollection('global.chat_completions_to_responses_policy', {
        enabled: true,
        all_channels: false,
        channel_ids: [1],
        model_patterns: ['(?i)gpt.*'],
        extension: 'keep',
      })
    ).not.toThrow()
    for (const value of [{ channel_ids: [0] }, { enabled: 'true' }, { model_patterns: [1] }])
      expect(() => validateSettingsCollection('global.chat_completions_to_responses_policy', value)).toThrow()
  })
  it('does not silently discard invalid group rate limits', () => {
    expect(() => validateSettingsCollection('ModelRequestRateLimitGroup', { default: [0, 1], pro: [100, 80] })).not.toThrow()
    for (const row of [
      [0, 0],
      [-1, 1],
      [1, 1.5],
      [1, null],
      [1, 2, 3],
      [2147483648, 1],
    ])
      expect(() => validateSettingsCollection('ModelRequestRateLimitGroup', { default: row })).toThrow()
  })
  it('validates the whole limit draft before enabling and disables first', () => {
    const section = settingsSections.limits,
      initial = { ModelRequestRateLimitEnabled: 'false', ModelRequestRateLimitCount: '10', ModelRequestRateLimitGroup: '{}' }
    expect(
      prepareOptionChanges(section, initial, { ...initial, ModelRequestRateLimitCount: '20', ModelRequestRateLimitEnabled: 'true' }, new Set()).map(
        (item) => item.key
      )
    ).toEqual(['ModelRequestRateLimitCount', 'ModelRequestRateLimitEnabled'])
    const enabled = { ...initial, ModelRequestRateLimitEnabled: 'true' }
    expect(
      prepareOptionChanges(section, enabled, { ...enabled, ModelRequestRateLimitCount: '20', ModelRequestRateLimitEnabled: 'false' }, new Set()).map(
        (item) => item.key
      )
    ).toEqual(['ModelRequestRateLimitEnabled', 'ModelRequestRateLimitCount'])
    expect(() =>
      prepareOptionChanges(section, initial, { ...initial, ModelRequestRateLimitCount: '20', ModelRequestRateLimitGroup: '{"bad":[0,0]}' }, new Set())
    ).toThrow()
  })
  it('saves the configured deduction amount before enabling deductions', () => {
    const initial = { 'grok.violation_deduction_enabled': 'false', 'grok.violation_deduction_amount': '0.05' }
    expect(
      prepareOptionChanges(
        settingsSections.models,
        initial,
        { ...initial, 'grok.violation_deduction_enabled': 'true', 'grok.violation_deduction_amount': '0.1' },
        new Set()
      ).map((item) => item.key)
    ).toEqual(['grok.violation_deduction_amount', 'grok.violation_deduction_enabled'])
  })
  it('accepts provider-specific budget minima and rejects out-of-range drafts', () => {
    const section = settingsSections.models,
      initial = { 'claude.thinking_adapter_budget_tokens_percentage': '0.5', 'gemini.thinking_adapter_budget_tokens_percentage': '0.5' }
    expect(
      prepareOptionChanges(
        section,
        initial,
        { ...initial, 'claude.thinking_adapter_budget_tokens_percentage': '0.1', 'gemini.thinking_adapter_budget_tokens_percentage': '0.002' },
        new Set()
      )
    ).toHaveLength(2)
    expect(() =>
      prepareOptionChanges(section, initial, { ...initial, 'claude.thinking_adapter_budget_tokens_percentage': '0.05' }, new Set())
    ).toThrow()
  })
})

describe('navigation preferences preserve native behavior', () => {
  it('keeps legacy disabled pricing disabled when editing its access flag', () => {
    const updated = JSON.parse(updateNavigationModule('{"pricing":false,"extension":{"keep":1}}', 'HeaderNavModules', 'pricing', true, 'requireAuth'))
    expect(updated).toEqual({ pricing: { enabled: false, requireAuth: true }, extension: { keep: 1 } })
  })
  it('preserves unknown nested properties when a known checkbox changes', () => {
    const updated = JSON.parse(
      updateNavigationModule('{"pricing":{"enabled":true,"requireAuth":false,"custom":"keep"}}', 'HeaderNavModules', 'pricing', true, 'requireAuth')
    )
    expect(updated.pricing.custom).toBe('keep')
    expect(updated.pricing.requireAuth).toBe(true)
  })
  it('normalizes legacy flags and keeps omitted sections at native defaults', () => {
    expect(parseHeaderNavModules('{"pricing":"0","rankings":{"enabled":"1","requireAuth":"true"}}').pricing).toEqual({
      enabled: false,
      requireAuth: false,
    })
    expect(parseHeaderNavModules('{"rankings":{"enabled":"1","requireAuth":"true"}}').rankings).toEqual({ enabled: true, requireAuth: true })
    expect(sidebarItemVisible('/wallet', '{"admin":{"enabled":false}}')).toBe(true)
  })
  it('allows user preferences to hide items but never reopen admin-hidden modules', () => {
    expect(sidebarItemVisible('/keys', '{"console":{"token":false}}', '{"console":{"token":true}}')).toBe(false)
    expect(sidebarItemVisible('/keys', '{}', '{"console":{"token":false}}')).toBe(false)
    expect(sidebarItemVisible('/channels', '{"admin":{"enabled":false}}')).toBe(false)
    expect(sidebarItemVisible('/ops/overview', '{"admin":{"channel":false}}')).toBe(false)
    expect(sidebarItemVisible('/keys', '{}', 'broken-json')).toBe(true)
  })
})

describe('model settings visual round trips', () => {
  it('preserves native conversion extensions and an explicit disabled flag', () => {
    const policy = { enabled: false, all_channels: false, channel_ids: [9], model_patterns: ['(?i)gpt.*'], extension: { keep: 0 } }
    expect(parseModelSetting('global.chat_completions_to_responses_policy', JSON.stringify(policy))).toEqual(policy)
  })
  it('retains exact Go regex strings, empty entries, zero tokens and header arrays', () => {
    expect(parseModelSetting('global.thinking_model_blacklist', '["re:(?i)claude.*",""]')).toEqual(['re:(?i)claude.*', ''])
    expect(parseModelSetting('claude.default_max_tokens', '{"model":0}')).toEqual({ model: 0 })
    expect(parseModelSetting('claude.model_headers_settings', '{"model":{"header":["  keep  ","second"]}}')).toEqual({
      model: { header: ['  keep  ', 'second'] },
    })
  })
  it('leaves unrepresentable JSON in raw mode instead of coercing types', () => {
    expect(parseModelSetting('gemini.safety_settings', '{"model":"future-threshold"}')).toBeNull()
    expect(parseModelSetting('claude.model_headers_settings', '{"model":{"header":"not-an-array"}}')).toBeNull()
    expect(parseModelSetting('global.chat_completions_to_responses_policy', '{"enabled":"false"}')).toBeNull()
    expect(parseModelSetting('gemini.version_settings', '{')).toBeNull()
  })
  it('refuses duplicate or blank mapping names without overwriting a model', () => {
    expect(
      modelMappingRecord([
        ['a', 0],
        ['a', 12],
      ])
    ).toBeNull()
    expect(modelMappingRecord([[' ', 0]])).toBeNull()
    expect(
      modelMappingRecord([
        ['a', 0],
        ['b', { x: ['v'] }],
      ])
    ).toEqual({ a: 0, b: { x: ['v'] } })
    expect(modelMappingRecord([['__proto__', 'v']])?.__proto__).toBe('v')
  })
})
