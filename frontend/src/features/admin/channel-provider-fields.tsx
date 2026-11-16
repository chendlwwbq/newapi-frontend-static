'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { channelProviderSettings, channelProviderSetting, vertexServiceAccounts } from './lib/channel-provider'
import type { ChannelDraft } from './lib/channel-form'

/** Provider-specific content inside the existing editor, sharing the same draft and submit. */
export function ChannelProviderFields(props: { draft: ChannelDraft; patch: (value: Partial<ChannelDraft>) => void }) {
  const { t } = useTranslation()
  const [fileError, setFileError] = useState('')
  const draft = props.draft
  if (![1, 3, 4, 8, 14, 18, 20, 21, 22, 33, 36, 39, 41, 45, 49, 57, 58, 59, 60, 62, 63].includes(draft.type || 0)) return null
  let settings: Record<string, unknown> = {},
    invalidSettings = false
  try {
    settings = channelProviderSettings(draft.settings)
  } catch {
    invalidSettings = true
  }
  const awsKey = String(settings.aws_key_type || 'ak_sk')
  const awsApi = String(settings.aws_api_type || 'invoke_model')
  const vertexKey = String(settings.vertex_key_type || 'json')
  const batch = !draft.id && draft.mode !== 'single'
  function setting(field: string, value: string | boolean) {
    props.patch({ settings: channelProviderSetting(draft.settings, field, value) })
  }
  return (
    <fieldset className="channel-provider-fields admin-wide">
      <legend>{t('Provider settings')}</legend>
      {invalidSettings ? (
        <p role="alert">{t('Invalid JSON object')}</p>
      ) : (
        <>
          {draft.type === 57 && (
            <p className="small-note admin-wide">
              {t('Codex channels use an OAuth JSON credential as the key.')}{' '}
              <code>{'{"access_token":"…","account_id":"…","refresh_token":"…"}'}</code>
            </p>
          )}
          {[18, 21, 39, 49].includes(draft.type || 0) && (
            <label className="field">
              <span>
                {t(({ 18: 'Model Version', 21: 'Knowledge base ID', 39: 'Account ID', 49: 'Agent ID' } as Record<number, string>)[draft.type!])}
              </span>
              <Input required value={draft.other || ''} onChange={(event) => props.patch({ other: event.target.value })} />
            </label>
          )}
          {draft.type === 20 && (
            <label className="checkbox-label admin-wide">
              <input
                type="checkbox"
                checked={settings.openrouter_enterprise === true}
                onChange={(event) => setting('openrouter_enterprise', event.target.checked)}
              />
              {t('Enterprise account')}
            </label>
          )}
          {draft.type === 4 && (
            <label className="checkbox-label admin-wide">
              <input
                type="checkbox"
                checked={settings.ollama_openai_chat === true}
                onChange={(event) => setting('ollama_openai_chat', event.target.checked)}
              />
              {t('Use OpenAI-compatible chat API')}
              <small>/v1/chat/completions</small>
            </label>
          )}
          {draft.type === 45 && (
            <label className="field">
              <span>{t('Region')}</span>
              <select
                value={
                  ['https://ark.cn-beijing.volces.com', 'https://ark.ap-southeast.bytepluses.com'].includes(draft.base_url || '')
                    ? draft.base_url || ''
                    : 'custom'
                }
                onChange={(event) => {
                  if (event.target.value !== 'custom') props.patch({ base_url: event.target.value })
                }}
              >
                <option value="custom">{t('Custom Base URL')}</option>
                <option value="https://ark.cn-beijing.volces.com">{t('Beijing')}</option>
                <option value="https://ark.ap-southeast.bytepluses.com">{t('Singapore')}</option>
              </select>
              <small>{t('Custom addresses can be edited in Base URL.')}</small>
            </label>
          )}
          {draft.type === 8 && (
            <p className="small-note admin-wide">{t('Custom channels use the full request URL as Base URL. Use {model} for the model name.')}</p>
          )}
          {draft.type === 22 && <p className="small-note admin-wide">{t('For self-hosted FastGPT, use the API base URL ending in /api.')}</p>}
          {draft.type === 36 && <p className="small-note admin-wide">{t('Use the upstream address before the /suno path.')}</p>}
          {[1, 14, 57, 58, 59, 60, 62, 63].includes(draft.type || 0) && (
            <>
              {[
                { key: 'allow_service_tier', label: 'Allow service_tier passthrough', types: [1, 14, 57, 58, 59, 60, 62, 63] },
                { key: 'disable_store', label: 'Disable store passthrough', types: [1, 57, 58, 59, 60, 62, 63] },
                { key: 'allow_safety_identifier', label: 'Allow safety_identifier passthrough', types: [1, 57, 58, 59, 60, 62, 63] },
                { key: 'allow_include_obfuscation', label: 'Allow include usage obfuscation passthrough', types: [1, 57, 58, 59, 60, 62, 63] },
                { key: 'allow_inference_geo', label: 'Allow inference_geo passthrough', types: [1, 14, 57, 58, 59, 60, 62, 63] },
                { key: 'allow_speed', label: 'Allow speed passthrough', types: [14, 58, 59, 60, 62, 63] },
                { key: 'claude_beta_query', label: 'Force Claude beta query', types: [14] },
              ]
                .filter((field) => field.types.includes(draft.type!))
                .map((field) => (
                  <label key={field.key} className="checkbox-label admin-wide">
                    <input type="checkbox" checked={settings[field.key] === true} onChange={(event) => setting(field.key, event.target.checked)} />
                    {t(field.label)}
                  </label>
                ))}
            </>
          )}
          {draft.type === 3 && (
            <>
              <label className="field">
                <span>{t('Default API Version')}</span>
                <Input
                  required
                  value={draft.other || ''}
                  placeholder="2025-04-01-preview"
                  onChange={(event) => props.patch({ other: event.target.value })}
                />
              </label>
              <label className="field">
                <span>{t('Responses API Version')}</span>
                <Input
                  value={String(settings.azure_responses_version || '')}
                  placeholder="preview"
                  onChange={(event) => setting('azure_responses_version', event.target.value)}
                />
                <small>{t('Default Responses API version, if empty, will use the API version above')}</small>
              </label>
            </>
          )}
          {draft.type === 33 && (
            <>
              <label className="field">
                <span>{t('AWS API')}</span>
                <select value={awsApi} onChange={(event) => setting('aws_api_type', event.target.value)}>
                  {!['invoke_model', 'mantle'].includes(awsApi) && <option value={awsApi}>{awsApi}</option>}
                  <option value="invoke_model">{t('InvokeModel (legacy)')}</option>
                  <option value="mantle">{t('Mantle (Messages API)')}</option>
                </select>
                <small>
                  {t('Use Mantle for supported Claude models and automatic prompt caching. Keep InvokeModel for older models and Amazon Nova.')}
                </small>
              </label>
              <label className="field">
                <span>{t('AWS Key Format')}</span>
                <select value={awsKey} onChange={(event) => setting('aws_key_type', event.target.value)}>
                  {!['ak_sk', 'api_key'].includes(awsKey) && <option value={awsKey}>{awsKey}</option>}
                  <option value="ak_sk">{t('AccessKey / SecretAccessKey')}</option>
                  <option value="api_key">{t('API Key')}</option>
                </select>
                <small>{t(awsKey === 'api_key' ? 'API Key mode: use APIKey|Region' : 'AK/SK mode: use AccessKey|SecretAccessKey|Region')}</small>
              </label>
            </>
          )}
          {draft.type === 41 && (
            <>
              <label className="field">
                <span>{t('Vertex AI Key Format')}</span>
                <select value={vertexKey} onChange={(event) => setting('vertex_key_type', event.target.value)}>
                  {!['json', 'api_key'].includes(vertexKey) && <option value={vertexKey}>{vertexKey}</option>}
                  <option value="json">JSON</option>
                  <option value="api_key">{t('API Key')}</option>
                </select>
                <small>
                  {t(vertexKey === 'api_key' ? 'API Key mode (does not support batch creation)' : 'JSON format supports service account JSON files')}
                </small>
              </label>
              {vertexKey === 'api_key' && (
                <label className="field">
                  <span>{t('Vertex AI Project ID')}</span>
                  <Input
                    value={String(settings.vertex_project_id || '')}
                    placeholder="my-project-123"
                    onChange={(event) => setting('vertex_project_id', event.target.value)}
                  />
                  <small>{t('Optional. Without it, Google picks the region; with it, requests go to the deployment region below.')}</small>
                </label>
              )}
              {vertexKey !== 'api_key' && (
                <label className="field">
                  <span>{t('Service account JSON file(s)')}</span>
                  <Input
                    type="file"
                    accept=".json,application/json"
                    multiple={batch}
                    onChange={async (event) => {
                      const files = Array.from(event.target.files || [])
                      event.target.value = ''
                      setFileError('')
                      if (!files.length) return
                      try {
                        props.patch({ key: vertexServiceAccounts(await Promise.all(files.map((file) => file.text())), batch) })
                      } catch {
                        setFileError('Vertex AI service account key must be valid JSON')
                      }
                    }}
                  />
                  <small>{t(batch ? 'Upload multiple JSON files in batch modes' : 'Upload a single service account JSON file')}</small>
                </label>
              )}
              <label className="field admin-wide">
                <span>{t('Deployment Region')}</span>
                <Textarea
                  required
                  rows={3}
                  value={draft.other || ''}
                  placeholder={'us-central1\n{"default":"global","gemini-4-argon":"us-central1"}'}
                  onChange={(event) => props.patch({ other: event.target.value })}
                />
                <small>{t('e.g., us-central1 or JSON format for model-specific regions')}</small>
              </label>
            </>
          )}
        </>
      )}
      {fileError && (
        <p role="alert" className="inline-error">
          {t(fileError)}
        </p>
      )}
    </fieldset>
  )
}
