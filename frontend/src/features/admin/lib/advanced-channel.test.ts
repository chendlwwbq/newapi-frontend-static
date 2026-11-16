import { expect, it } from 'vitest'
import { channelRequest, newChannel } from './channel-form'
import { channelProviderSetting, channelProviderTypeChange } from './channel-provider'
import { createAdvancedCustomRoute, getAdvancedCustomTemplateConfig, validateAdvancedCustomConfig, buildAdvancedCustomAuth } from './advanced-custom'
import type { AdvancedCustomRoute } from './advanced-custom-types'

const draft = (routes: AdvancedCustomRoute[]) => ({
  ...newChannel,
  type: 58,
  base_url: 'https://upstream.example',
  settings: JSON.stringify({ custom: { enabled: false }, advanced_custom: { advanced_routes: routes } }),
})
it('saves all four native templates while preserving unrelated provider settings', () => {
  for (const name of ['all_protocols', 'openai_only', 'claude_only', 'gemini_only']) {
    const config = getAdvancedCustomTemplateConfig(name)!
    expect(validateAdvancedCustomConfig(config)).toBeNull()
    const body = channelRequest(draft(config.advanced_routes!), true)
    expect(body).toHaveProperty('channel.settings')
    expect(JSON.parse((body as { channel: Record<string, string> }).channel.settings).custom).toEqual({ enabled: false })
  }
})
it('requires Base URL only for relative upstream paths', () => {
  const route = createAdvancedCustomRoute()
  expect(() => channelRequest({ ...draft([route]), base_url: '' }, true)).toThrow('Base URL is required')
  expect(() => channelRequest({ ...draft([{ ...route, upstream_path: 'https://upstream.example/chat' }]), base_url: '' }, true)).not.toThrow()
})
it('rejects conflicting model rules, misplaced catch-all and incompatible converters', () => {
  const route = createAdvancedCustomRoute()
  for (const routes of [
    [route, { ...route, models: ['model'] }],
    [
      { ...route, models: ['model'] },
      { ...route, models: ['model'] },
    ],
    [{ ...route, models: ['re:'] }],
    [{ ...route, converter: 'claude_messages_to_openai_responses' as const }],
  ])
    expect(() => channelRequest(draft(routes), true)).toThrow()
  expect(() => channelRequest(draft([{ ...route, models: ['model', 're:^prefix-'] }, route]), true)).not.toThrow()
})
it('enforces management route restrictions and requires a models route for automatic checks', () => {
  const route = createAdvancedCustomRoute()
  for (const path of ['/v1/models', '/v1/dashboard/billing/credit_grants'])
    for (const patch of [{ models: ['m'] }, { upstream_path: '/model/{model}' }, { pass_through_body_enabled: true }])
      expect(() => channelRequest(draft([{ ...route, incoming_path: path, ...patch }]), true)).toThrow()
  const value = draft([route])
  value.settings = channelProviderSetting(value.settings, 'upstream_model_update_check_enabled', true)
  expect(() => channelRequest(value, true)).toThrow('OpenAI Models route is required')
})
it('retains auth placeholders and rejects incomplete auth or pass-through conversions', () => {
  const route = createAdvancedCustomRoute()
  expect(buildAdvancedCustomAuth('header', undefined)).toEqual({ type: 'header', name: 'Authorization', value: 'Bearer {api_key}' })
  for (const patch of [
    { auth: { type: 'header' as const, name: 'x-api-key', value: '' } },
    { converter: 'openai_chat_completions_to_openai_responses' as const, pass_through_body_enabled: true },
  ])
    expect(() => channelRequest(draft([{ ...route, ...patch }]), true)).toThrow()
})
it('validates new Codex credential replacements without requiring a readback of existing secrets', () => {
  for (const key of ['secret-sentinel', '[]', '{}', '{"access_token":"a"}', '{"access_token":1,"account_id":"b"}'])
    expect(() => channelRequest({ ...newChannel, type: 57, key }, true)).toThrow('Codex credential must be')
  expect(() => channelRequest({ ...newChannel, type: 57, key: '{"access_token":"a","account_id":"b"}' }, true)).not.toThrow()
  expect(channelRequest({ ...newChannel, id: 7, type: 57, key: '' }, true)).not.toHaveProperty('key')
  for (const mode of ['batch', 'multi_to_single'])
    expect(() => channelRequest({ ...newChannel, type: 57, mode }, true)).toThrow('Codex channels do not support batch creation')
})
it('saves boolean provider options and removes only obsolete provider fields on an explicit type change', () => {
  const settings = channelProviderSetting('{"custom":0}', 'openrouter_enterprise', false)
  expect(JSON.parse(settings)).toEqual({ custom: 0, openrouter_enterprise: false })
  expect(
    JSON.parse(
      channelProviderTypeChange(
        { ...draft([]), settings: '{"advanced_custom":{},"openrouter_enterprise":true,"ollama_openai_chat":true,"custom":0}' },
        1
      ).settings!
    )
  ).toEqual({ custom: 0 })
  for (const type of [18, 21, 39, 49]) expect(() => channelRequest({ ...newChannel, type }, true)).toThrow('additional configuration')
})
it('ordinary editors of plugin and advanced channels never submit provider type, settings or credentials', () => {
  for (const type of [58, 61]) {
    const body = channelRequest({ ...newChannel, id: 9, type, settings: '{"task_plugin_key":"existing"}', key: 'unused', remark: 'metadata' }, false)
    expect(body).toMatchObject({ id: 9, remark: 'metadata' })
    for (const key of ['type', 'settings', 'key', 'multi_key_mode']) expect(body).not.toHaveProperty(key)
  }
})
