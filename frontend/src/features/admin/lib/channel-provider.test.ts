import { expect, it } from 'vitest'
import { channelRequest, newChannel } from './channel-form'
import {
  channelProviderSetting,
  channelProviderSettings,
  channelProviderTypeChange,
  vertexDeploymentRegions,
  vertexServiceAccounts,
} from './channel-provider'

it('preserves unknown provider settings while updating or clearing an Azure override', () => {
  const source = '{"custom":{"enabled":false},"azure_responses_version":"old"}'
  expect(JSON.parse(channelProviderSetting(source, 'azure_responses_version', ' preview '))).toEqual({
    custom: { enabled: false },
    azure_responses_version: 'preview',
  })
  expect(JSON.parse(channelProviderSetting(source, 'azure_responses_version', ''))).toEqual({ custom: { enabled: false } })
  expect(channelRequest({ ...newChannel, type: 3, other: '2025-04-01-preview', settings: source }, true)).toMatchObject({
    channel: { other: '2025-04-01-preview', settings: source },
  })
})
it('round-trips AWS interface and key format without replacing an existing secret', () => {
  let settings = channelProviderSetting('{"custom":0}', 'aws_api_type', 'mantle')
  settings = channelProviderSetting(settings, 'aws_key_type', 'api_key')
  const body = channelRequest({ ...newChannel, id: 8, type: 33, settings }, true)
  expect(JSON.parse(settings)).toEqual({ custom: 0, aws_api_type: 'mantle', aws_key_type: 'api_key' })
  expect(body).toHaveProperty('settings', settings)
  expect(body).not.toHaveProperty('key')
})
it('removes provider-specific settings on an explicit provider change, preserving extensions', () => {
  const patch = channelProviderTypeChange(
    {
      ...newChannel,
      settings: '{"aws_api_type":"mantle","aws_key_type":"api_key","vertex_project_id":"old","azure_responses_version":"preview","custom":true}',
    },
    3
  )
  expect(JSON.parse(patch.settings!)).toEqual({ azure_responses_version: 'preview', custom: true })
})
it('normalizes plain Vertex regions and preserves model-specific map entries', () => {
  expect(vertexDeploymentRegions(' us-central1 ')).toBe('{"default":"us-central1"}')
  expect(JSON.parse(vertexDeploymentRegions('{"default":"global","gemini-test":"europe-west1"}'))).toEqual({
    default: 'global',
    'gemini-test': 'europe-west1',
  })
  for (const region of ['', '{"model":"us-central1"}', '{"default":0}', '{"default":"global","model":false}'])
    expect(() => vertexDeploymentRegions(region)).toThrow()
})
it('clears the optional Vertex project when switching back to service account JSON', () => {
  expect(JSON.parse(channelProviderSetting('{"vertex_project_id":"old","custom":false}', 'vertex_key_type', 'json'))).toEqual({
    custom: false,
    vertex_key_type: 'json',
  })
  expect(JSON.parse(channelProviderSetting('{}', 'vertex_project_id', ' my-project '))).toEqual({ vertex_project_id: 'my-project' })
})
it('imports single and batch JSON account files without reading back server credentials', () => {
  expect(JSON.parse(vertexServiceAccounts(['{"project_id":"p"}'], false))).toEqual({ project_id: 'p' })
  expect(JSON.parse(vertexServiceAccounts(['{"project_id":"a"}', '{"project_id":"b"}'], true))).toHaveLength(2)
  for (const value of ['[]', 'null', '{}', 'secret-sentinel-invalid']) expect(() => vertexServiceAccounts([value], false)).toThrow()
  try {
    channelProviderSettings('secret-sentinel-invalid')
  } catch (error) {
    expect(String(error)).not.toContain('secret-sentinel')
  }
})
it('serializes native Vertex creation and rejects unsupported API-key batches', () => {
  const draft = { ...newChannel, type: 41, other: 'global', key: '{"project_id":"p"}', settings: '{"vertex_key_type":"json"}' }
  expect(channelRequest(draft, true)).toMatchObject({ channel: { other: '{"default":"global"}', key: '{"project_id":"p"}' } })
  expect(() => channelRequest({ ...draft, mode: 'batch', settings: '{"vertex_key_type":"api_key"}' }, true)).toThrow(
    'does not support batch creation'
  )
  expect(channelRequest({ ...draft, mode: 'batch', key: '[{"project_id":"a"},{"project_id":"b"}]' }, true)).toMatchObject({
    mode: 'batch',
    channel: { key: '[{"project_id":"a"},{"project_id":"b"}]' },
  })
})
it('does not validate or submit provider fields without sensitive write permission', () => {
  const body = channelRequest({ ...newChannel, id: 8, type: 41, other: '', settings: 'invalid', key: 'do-not-send' }, false)
  for (const key of ['settings', 'other', 'key', 'type', 'multi_key_mode']) expect(body).not.toHaveProperty(key)
})
