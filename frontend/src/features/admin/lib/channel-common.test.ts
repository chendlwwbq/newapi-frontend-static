import { expect, it } from 'vitest'
import { channelRequest, newChannel } from './channel-form'
import {
  channelSettingsPatch,
  channelProtocolPatch,
  channelModelCheckPatch,
  channelModelChecksAvailable,
  channelIgnoredModels,
  channelSupportsWebSocket,
  channelProxyValid,
} from './channel-common'

it('patches common settings without losing native plugin bindings and unknown extensions', () => {
  const source = '{"task_plugin_key":"existing","custom":{"enabled":false},"proxy":"http://old.test"}'
  expect(JSON.parse(channelSettingsPatch(source, { proxy: '', thinking_to_content: true }))).toEqual({
    task_plugin_key: 'existing',
    custom: { enabled: false },
    proxy: '',
    thinking_to_content: true,
  })
  for (const value of ['broken', 'null', '[]']) expect(() => channelSettingsPatch(value, { proxy: '' })).toThrow('Invalid JSON object')
})
it('clears shards when choosing HTTP/1.1 and returns to default negotiation without deleting extensions', () => {
  const http1 = channelProtocolPatch('{"http2_connection_shards":8,"custom":0}', 'http1')
  expect(JSON.parse(http1)).toEqual({ http_protocol: 'http1', custom: 0 })
  expect(JSON.parse(channelProtocolPatch(http1, 'auto'))).toEqual({ custom: 0 })
})
it('rejects unsupported protocols, fractional shard counts and HTTP/1.1 sharding conflicts at submit', () => {
  for (const setting of [
    { http_protocol: 'h3' },
    { http_protocol: 1 },
    { http2_connection_shards: -1 },
    { http2_connection_shards: 9 },
    { http2_connection_shards: 1.5 },
    { http_protocol: 'http1', http2_connection_shards: 2 },
  ])
    expect(() => channelRequest({ ...newChannel, setting: JSON.stringify(setting) }, true)).toThrow()
  for (const setting of [
    { http_protocol: 'AUTO', http2_connection_shards: 8 },
    { http_protocol: 'http1', http2_connection_shards: 1 },
    { http2_connection_shards: 0 },
  ])
    expect(() => channelRequest({ ...newChannel, setting: JSON.stringify(setting) }, true)).not.toThrow()
})
it('accepts native HTTP/HTTPS/SOCKS5/SOCKS5H proxy forms including IPv6 and rejects paths or invalid ports', () => {
  for (const proxy of ['', ' http://localhost:8080 ', 'https://host/', 'socks5://user:pass@host:1080', 'socks5h://[::1]:1080'])
    expect(channelProxyValid(proxy)).toBe(true)
  for (const proxy of [
    'host:8080',
    'ftp://host',
    'http://',
    'http://host:0',
    'http://host/path',
    'http://host/?query=1',
    'http://host#fragment',
    'socks5://host:99999',
  ])
    expect(channelProxyValid(proxy)).toBe(false)
})
it('trims proxy input on submission without disclosing malformed credentials in the error', () => {
  expect(channelRequest({ ...newChannel, id: 3, setting: '{"proxy":"  http://localhost:8080  ","custom":0}' }, true)).toHaveProperty(
    'setting',
    '{"proxy":"http://localhost:8080","custom":0}'
  )
  try {
    channelRequest({ ...newChannel, setting: '{"proxy":"socks5://private-user:private-password@host/bad"}' }, true)
    throw new Error('expected rejection')
  } catch (error) {
    expect(String(error)).toContain('Proxy address must')
    expect(String(error)).not.toContain('private-password')
  }
})
it('leaves prompt whitespace and false request switches intact', () => {
  const setting = {
    system_prompt: '  channel prompt\n',
    system_prompt_override: false,
    thinking_to_content: false,
    pass_through_body_enabled: false,
    force_format: false,
    tls_insecure_skip_verify: false,
  }
  const body = channelRequest({ ...newChannel, id: 3, setting: JSON.stringify(setting) }, true)
  expect(body).toHaveProperty('setting', JSON.stringify(setting))
})
it('permits Responses WebSocket only for native compatible channel types', () => {
  for (const type of [1, 57, 58, 59, 60]) expect(channelSupportsWebSocket(type)).toBe(true)
  for (const type of [3, 14, 24, 33, 41, 61, 62, 63]) expect(channelSupportsWebSocket(type)).toBe(false)
  const body = channelRequest({ ...newChannel, id: 3, type: 14, setting: '{"responses_websocket_enabled":true,"custom":0}' }, true)
  expect(body).toHaveProperty('setting', '{"responses_websocket_enabled":false,"custom":0}')
})
it('turns off automatic synchronization when model checks are disabled without losing ignored rules or metadata', () => {
  const settings = channelModelCheckPatch(
    '{"upstream_model_update_auto_sync_enabled":true,"upstream_model_update_last_detected_models":["m"],"upstream_model_update_last_check_time":123,"upstream_model_update_ignored_models":["regex:^private-"],"custom":0}',
    false
  )
  expect(JSON.parse(settings)).toEqual({
    upstream_model_update_check_enabled: false,
    upstream_model_update_auto_sync_enabled: false,
    upstream_model_update_last_detected_models: [],
    upstream_model_update_last_check_time: 123,
    upstream_model_update_ignored_models: ['regex:^private-'],
    custom: 0,
  })
})
it('requires a valid native models route before enabling advanced custom model checks', () => {
  expect(channelModelChecksAvailable(58, '{}')).toBe(false)
  expect(
    channelModelChecksAvailable(
      58,
      JSON.stringify({ advanced_custom: { advanced_routes: [{ incoming_path: '/v1/models', upstream_path: '/models', converter: 'none' }] } })
    )
  ).toBe(true)
  expect(channelModelChecksAvailable(1, '{}')).toBe(true)
  expect(channelModelChecksAvailable(61, '{}')).toBe(false)
})
it('normalizes ignored models without confusing the native regex: syntax with route re: rules', () => {
  expect(channelIgnoredModels(' a,regex:^internal-\n a, regex:^other- ,')).toEqual(['a', 'regex:^internal-', 'regex:^other-'])
})
it('ordinary writers never submit or validate hidden common settings and provider options', () => {
  const body = channelRequest(
    { ...newChannel, id: 3, setting: '{"proxy":"hidden-invalid-proxy"}', settings: '{"upstream_model_update_auto_sync_enabled":true}' },
    false
  )
  expect(body).not.toHaveProperty('setting')
  expect(body).not.toHaveProperty('settings')
})
