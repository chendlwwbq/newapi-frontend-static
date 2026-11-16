'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toIntlLocale } from '@/i18n/languages'
import { AdminConfirm } from './shared'
import { channelProviderSettings } from './lib/channel-provider'
import {
  channelSettingsPatch,
  channelProtocolPatch,
  channelModelCheckPatch,
  channelModelChecksAvailable,
  channelIgnoredModels,
  channelSupportsWebSocket,
  MODEL_UPDATE_TYPES,
} from './lib/channel-common'
import type { ChannelDraft } from './lib/channel-form'

export function ChannelCommonFields({ draft, patch }: { draft: ChannelDraft; patch: (value: Partial<ChannelDraft>) => void }) {
  const { t, i18n } = useTranslation(),
    [passthrough, setPassthrough] = useState(false)
  let setting: Record<string, unknown> = {},
    settings: Record<string, unknown> = {}
  try {
    setting = channelProviderSettings(draft.setting)
    settings = channelProviderSettings(draft.settings)
  } catch {
    return (
      <p className="inline-error admin-wide" role="alert">
        {t('Invalid JSON object')}
      </p>
    )
  }
  const protocol = String(setting.http_protocol || 'auto')
      .trim()
      .toLowerCase(),
    shards = Number(setting.http2_connection_shards) || 1,
    type = draft.type || 0
  const checks = settings.upstream_model_update_check_enabled === true,
    checkAvailable = channelModelChecksAvailable(type, draft.settings)
  const ignored = Array.isArray(settings.upstream_model_update_ignored_models)
    ? settings.upstream_model_update_ignored_models.filter((value): value is string => typeof value === 'string')
    : []
  const added = Array.isArray(settings.upstream_model_update_last_detected_models) ? settings.upstream_model_update_last_detected_models : [],
    removed = Array.isArray(settings.upstream_model_update_last_removed_models) ? settings.upstream_model_update_last_removed_models : []
  const last = settings.upstream_model_update_last_check_time,
    locale = toIntlLocale(i18n.language)
  function change(field: 'setting' | 'settings', values: Record<string, unknown>) {
    patch({ [field]: channelSettingsPatch(draft[field], values) })
  }
  const requestOptions = [
    { key: 'system_prompt_override', label: 'System Prompt Concatenation', hint: "Concatenate channel system prompt with user's prompt" },
    { key: 'thinking_to_content', label: 'Thinking to Content', hint: 'Convert reasoning_content to <think> tag in content' },
    {
      key: 'pass_through_body_enabled',
      label: 'Pass Through Body',
      hint: 'Preserve upstream-specific fields when API formats match; bypasses model redirect, parameter override and format conversion',
    },
    ...(type === 1 ? [{ key: 'force_format', label: 'Force Format', hint: 'Force format response to OpenAI standard (OpenAI channel only)' }] : []),
  ]
  return (
    <>
      <details className="channel-common-fields admin-wide">
        <summary>{t('Transport settings')}</summary>
        <div className="admin-form-grid">
          <label className="field">
            <span>{t('HTTP Protocol')}</span>
            <select value={protocol} onChange={(event) => patch({ setting: channelProtocolPatch(draft.setting, event.target.value) })}>
              {!['auto', 'http1'].includes(protocol) && <option value={protocol}>{protocol}</option>}
              <option value="auto">{t('Auto')}</option>
              <option value="http1">HTTP/1.1</option>
            </select>
            <small>{t('Auto negotiates HTTP/2 when available. HTTP/1.1 forces multiple keep-alive connections under concurrency.')}</small>
          </label>
          <label className="field">
            <span>{t('HTTP/2 Connection Shards')}</span>
            <select
              disabled={protocol === 'http1'}
              value={protocol === 'http1' ? 1 : shards}
              onChange={(event) =>
                change('setting', { http2_connection_shards: Number(event.target.value) === 1 ? undefined : Number(event.target.value) })
              }
            >
              {Array.from({ length: 8 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
            <small>{t('Separate HTTP/2 connections for concurrent upstream requests. HTTP/1.1 uses one shard setting.')}</small>
          </label>
          <label className="field admin-wide">
            <span>{t('Proxy Address')}</span>
            <Input
              autoComplete="off"
              spellCheck={false}
              value={String(setting.proxy || '')}
              placeholder="socks5://host:1080"
              onChange={(event) => change('setting', { proxy: event.target.value })}
            />
            <small>{t('Network proxy for this channel (supports HTTP, HTTPS, SOCKS5, and SOCKS5H)')}</small>
          </label>
          <label className="channel-setting-option admin-wide">
            <input
              type="checkbox"
              checked={setting.tls_insecure_skip_verify === true}
              onChange={(event) => change('setting', { tls_insecure_skip_verify: event.target.checked || undefined })}
            />
            <span>
              {t('Skip Upstream TLS Verification')}
              <small>
                {t('Accept upstream certificates that fail validation, such as self-signed ones. Only enable for trusted internal upstreams.')}
              </small>
            </span>
          </label>
        </div>
      </details>
      <details className="channel-common-fields admin-wide">
        <summary>{t('Request processing')}</summary>
        <div className="admin-form-grid">
          <label className="field admin-wide">
            <span>{t('System Prompt')}</span>
            <Textarea
              rows={3}
              value={String(setting.system_prompt || '')}
              onChange={(event) => change('setting', { system_prompt: event.target.value })}
            />
            <small>{t('Default system prompt for this channel')}</small>
          </label>
          {requestOptions.map((option) => (
            <label className="channel-setting-option admin-wide" key={option.key}>
              <input
                type="checkbox"
                checked={setting[option.key] === true}
                onChange={(event) => {
                  if (option.key === 'pass_through_body_enabled' && event.target.checked) setPassthrough(true)
                  else change('setting', { [option.key]: event.target.checked })
                }}
              />
              <span>
                {t(option.label)}
                <small>{t(option.hint)}</small>
              </span>
            </label>
          ))}
          {type === 58 && (
            <p className="small-note admin-wide">
              {t(
                'Channel-level body passthrough applies to all routes. Requests to routes that require format conversion will fail. To enable passthrough for selected routes only, use the route-level switches instead.'
              )}
            </p>
          )}
          <label className="channel-setting-option admin-wide">
            <input
              type="checkbox"
              checked={settings.disable_task_polling_sleep === true}
              onChange={(event) => change('settings', { disable_task_polling_sleep: event.target.checked })}
            />
            <span>
              {t('Skip async task polling delay')}
              <small>{t('Do not wait one second between polling async tasks for this channel')}</small>
            </span>
          </label>
        </div>
      </details>
      {(MODEL_UPDATE_TYPES.has(type) || channelSupportsWebSocket(type)) && (
        <details className="channel-common-fields admin-wide">
          <summary>{t('Model updates and WebSocket')}</summary>
          <div className="admin-form-grid">
            {channelSupportsWebSocket(type) && (
              <label className="channel-setting-option admin-wide">
                <input
                  type="checkbox"
                  checked={setting.responses_websocket_enabled === true}
                  onChange={(event) => change('setting', { responses_websocket_enabled: event.target.checked })}
                />
                <span>
                  {t('Enable Responses WebSocket')}
                  <small>{t('Enable only if the upstream supports Responses WebSocket. HTTP requests are unaffected when disabled.')}</small>
                  {type === 58 && (
                    <small>{t('For advanced custom channels this applies only to /v1/responses routes without protocol conversion.')}</small>
                  )}
                </span>
              </label>
            )}
            {MODEL_UPDATE_TYPES.has(type) && (
              <>
                <label className="channel-setting-option admin-wide">
                  <input
                    type="checkbox"
                    disabled={!checkAvailable && !checks}
                    checked={checks}
                    onChange={(event) => patch({ settings: channelModelCheckPatch(draft.settings, event.target.checked) })}
                  />
                  <span>
                    {t('Detect Upstream Model Updates')}
                    <small>{t('Check upstream model changes periodically and show pending additions and removals.')}</small>
                  </span>
                </label>
                {!checkAvailable && <p className="small-note admin-wide">{t('OpenAI Models route is required to enable upstream model checks')}</p>}
                <label className="channel-setting-option admin-wide">
                  <input
                    type="checkbox"
                    disabled={!checks || !checkAvailable}
                    checked={checks && settings.upstream_model_update_auto_sync_enabled === true}
                    onChange={(event) => change('settings', { upstream_model_update_auto_sync_enabled: event.target.checked })}
                  />
                  <span>
                    {t('Auto Sync Upstream Models')}
                    <small>{t('Automatically sync model list when upstream changes are detected')}</small>
                  </span>
                </label>
                <label className="field admin-wide">
                  <span>{t('Ignored upstream models')}</span>
                  <Textarea
                    key={JSON.stringify(ignored)}
                    rows={2}
                    defaultValue={ignored.join(',')}
                    placeholder="gpt-example,regex:^internal-"
                    onBlur={(event) => change('settings', { upstream_model_update_ignored_models: channelIgnoredModels(event.target.value) })}
                  />
                  <small>{t('Comma-separated exact model names. Prefix with regex: to ignore by regular expression.')}</small>
                </label>
                <dl className="channel-update-meta admin-wide">
                  <div>
                    <dt>{t('Last check time')}</dt>
                    <dd>{typeof last === 'number' && last > 0 ? new Date(last * 1000).toLocaleString(locale) : t('None')}</dd>
                  </div>
                  <div>
                    <dt>{t('Last detected addable models')}</dt>
                    <dd>{added.length ? added.map(String).join(', ') : t('None')}</dd>
                  </div>
                  <div>
                    <dt>{t('Last detected removable models')}</dt>
                    <dd>{removed.length ? removed.map(String).join(', ') : t('None')}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </details>
      )}
      {passthrough && (
        <AdminConfirm
          title={t('Enable request body passthrough?')}
          description={[
            t('After enabling, the original request body is forwarded to the upstream without gateway rewriting:'),
            t('Model redirect is unavailable'),
            t('Parameter override and system prompt are unavailable'),
            t('Format conversion is unavailable; the client must use a format the upstream supports'),
          ].join(' ')}
          busy={false}
          onClose={() => setPassthrough(false)}
          onConfirm={() => {
            change('setting', { pass_through_body_enabled: true })
            setPassthrough(false)
          }}
        />
      )}
    </>
  )
}
