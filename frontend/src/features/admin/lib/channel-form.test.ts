import { expect, it } from 'vitest'
import { channelRequest, newChannel } from './channel-form'
import { channelTagRequest, channelKeyRequest } from './channel-operations'
import { channelPluginKeys, channelPluginSetting } from './channel-plugin-binding'
import { channelPriorityUndo } from './channel-priority'
import { recentMetrics, metricValue, metricRatio, metricMean, type InferenceStatus } from './inference-status'
import { nextTaskPluginBaseUrl } from './task-plugin-base-url'

it('preserves existing credentials and status when editing routing metadata', () => {
  const body = channelRequest(
    { ...newChannel, id: 7, status: 2, used_quota: 900, key: '', channel_info: { is_multi_key: true, multi_key_size: 2, multi_key_mode: 'polling' } },
    true
  )
  expect(body).not.toHaveProperty('key')
  expect(body).not.toHaveProperty('status')
  expect(body).not.toHaveProperty('used_quota')
  expect(body).not.toHaveProperty('channel_info')
})
it('does not submit sensitive configuration with ordinary write permission', () => {
  const body = channelRequest(
    {
      ...newChannel,
      id: 3,
      key: 'secret',
      base_url: 'https://elsewhere.test',
      header_override: '{"Authorization":"secret"}',
      setting: '{"proxy":"secret"}',
    },
    false
  )
  for (const field of ['key', 'base_url', 'header_override', 'setting']) expect(body).not.toHaveProperty(field)
})
it('uses the native multi-key envelope and normalizes newline-separated models', () => {
  const body = channelRequest(
    { ...newChannel, mode: 'multi_to_single', models: ' gpt-a\n gpt-b, ', key: 'one\ntwo', multi_key_mode: 'polling' },
    true
  )
  expect(body).toMatchObject({ mode: 'multi_to_single', multi_key_mode: 'polling', channel: { models: 'gpt-a,gpt-b', key: 'one\ntwo' } })
})

it('applies only checked tag fields, retaining zero and explicit clearing', () => {
  expect(channelTagRequest(' production ', { priority: '0', weight: '0', new_tag: '', model_mapping: '' }, true)).toEqual({
    tag: 'production',
    priority: 0,
    weight: 0,
    new_tag: '',
    model_mapping: '',
  })
  expect(channelTagRequest('production', { models: ' a\n b,a ', groups: 'default, vip\n default' }, true)).toEqual({
    tag: 'production',
    models: 'a,b',
    groups: 'default,vip',
  })
})
it('keeps sensitive tag overrides out of ordinary-write requests', () => {
  expect(channelTagRequest('tag', { priority: '3', param_override: '{"n":1}', header_override: '{"x":"v"}' }, false)).toEqual({
    tag: 'tag',
    priority: 3,
  })
})
it('rejects empty tag changes, fractional priorities and invalid mapping objects', () => {
  for (const changes of [{}, { priority: '1.5' }, { weight: '-1' }, { priority: '' }, { model_mapping: '[]' }, { header_override: 'broken' }])
    expect(() => channelTagRequest('tag', changes, true)).toThrow()
})
it('uses native zero-based key indices and omits indices on all-key operations', () => {
  expect(channelKeyRequest(7, 'disable_key', 0)).toEqual({ channel_id: 7, action: 'disable_key', key_index: 0 })
  expect(channelKeyRequest(7, 'enable_all_keys', 9)).toEqual({ channel_id: 7, action: 'enable_all_keys' })
  expect(() => channelKeyRequest(7, 'delete_key', -1)).toThrow()
  expect(() => channelKeyRequest(7, 'enable_key')).toThrow()
})

it('merges gateway plugin bindings without losing unrelated settings or legacy selections', () => {
  const setting = '{"proxy":"http://local","custom":{"enabled":false},"task_plugin_key":"legacy","task_extend_plugin_keys":["legacy","b"," "]}'
  expect(channelPluginKeys(setting)).toEqual(['legacy', 'b'])
  expect(JSON.parse(channelPluginSetting(setting, 60, ['legacy', 'b', 'b']))).toEqual({
    proxy: 'http://local',
    custom: { enabled: false },
    task_plugin_key: '',
    task_extend_plugin_keys: ['legacy', 'b'],
  })
})
it('uses one dedicated task plugin and rejects invalid settings rather than erasing them', () => {
  expect(JSON.parse(channelPluginSetting('{"proxy":"keep","task_extend_plugin_keys":["old"]}', 61, ['new']))).toEqual({
    proxy: 'keep',
    task_plugin_key: 'new',
  })
  for (const setting of ['[]', 'null', 'broken']) expect(() => channelPluginSetting(setting, 60, ['a'])).toThrow()
  expect(() => channelPluginSetting('{}', 61, [])).toThrow()
})
it('retains custom upstream addresses when switching plugin defaults', () => {
  expect(nextTaskPluginBaseUrl('https://custom.test', 'https://old.test', 'https://next.test')).toBeNull()
  expect(nextTaskPluginBaseUrl('https://old.test/', 'https://old.test', 'https://next.test')).toBe('https://next.test')
})
it('binds priority undo to the committed revision and restores explicit null/zero values', () => {
  expect(
    channelPriorityUndo({
      revision: 'committed',
      items: [],
      changes: [
        { id: 1, previous: null, priority: 0 },
        { id: 2, previous: 0, priority: -1 },
      ],
    })
  ).toEqual({
    revision: 'committed',
    restore: [
      { id: 1, previous: 0, priority: null },
      { id: 2, previous: -1, priority: 0 },
    ],
  })
})
it('keeps inference averages unavailable when counters are missing or empty', () => {
  expect(metricRatio(0, 2)).toBe(0)
  expect(metricRatio(2, 0)).toBeUndefined()
  expect(
    metricMean(
      [
        { name: 'latency_sum', value: 6, labels: {} },
        { name: 'latency_count', value: 2, labels: {} },
      ],
      'latency'
    )
  ).toBe(3)
  expect(
    metricValue(
      [
        { name: 'cache', value: 0.2, labels: { worker: 'a' } },
        { name: 'cache', value: 0.7, labels: { worker: 'b' } },
      ],
      'cache',
      {},
      'max'
    )
  ).toBe(0.7)
})
it('restarts inference rate sampling after upstream restart or labelled series changes', () => {
  const before: InferenceStatus = {
    sampled_at: 1000,
    endpoints: { '/metrics': { status: 200 } },
    version: 'v',
    models: [],
    raw_metrics: '',
    metrics: [
      { name: 'process_start_time_seconds', value: 10, labels: {} },
      { name: 'vllm:prompt_tokens_total', value: 100, labels: { model: 'a' } },
    ],
  }
  const after = {
    ...before,
    sampled_at: 3000,
    metrics: [before.metrics[0], { name: 'vllm:prompt_tokens_total', value: 160, labels: { model: 'a' } }],
  }
  expect(recentMetrics(after, before)).toMatchObject({ seconds: 2, metrics: [{ value: 60 }] })
  expect(recentMetrics({ ...after, metrics: [{ ...before.metrics[0], value: 11 }, after.metrics[1]] }, before)).toBeUndefined()
  expect(recentMetrics({ ...after, metrics: [before.metrics[0], { ...after.metrics[1], labels: { model: 'b' } }] }, before)).toBeUndefined()
})
