'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { channelSettingsPatch } from './lib/channel-common'
import { channelPluginKeys, channelPluginSetting, type ChannelPluginOption } from './lib/channel-plugin-binding'
import { channelProviderSettings } from './lib/channel-provider'
import { assessBaseUrlTrust, nextTaskPluginBaseUrl } from './lib/task-plugin-base-url'
import type { ChannelDraft } from './lib/channel-form'

export function ChannelPluginFields({
  draft,
  ownerId,
  patch,
}: {
  draft: ChannelDraft
  ownerId: number
  patch: (value: Partial<ChannelDraft>) => void
}) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['channel-plugin-options', ownerId],
    queryFn: ({ signal }) => api<ChannelPluginOption[]>('/api/task_plugin_options', { signal }),
  })
  let selected: string[] = [],
    parseError = ''
  let channelPrices: Record<string, string> = {}
  try {
    selected = channelPluginKeys(draft.setting)
    const prices = channelProviderSettings(draft.setting).task_billing_expressions
    if (prices && typeof prices === 'object' && !Array.isArray(prices)) {
      channelPrices = Object.fromEntries(Object.entries(prices).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    }
  } catch {
    parseError = 'Invalid JSON object'
  }
  const plugins = query.data || [],
    gateway = draft.type === 60,
    dedicated = draft.type === 61
  const options = plugins.filter((plugin) => !gateway || plugin.upstreams?.includes('new_api'))
  const extensions = plugins.filter((plugin) => plugin.channelTypes?.includes(draft.type || 0))
  const shown = dedicated ? plugins.filter((plugin) => selected.includes(plugin.key)) : extensions
  const gatewayPlugins = plugins.filter((plugin) => selected.includes(plugin.key))
  const selectedPlugin = plugins.find((plugin) => plugin.key === selected[0])
  const priceModels = new Set(Object.keys(channelPrices))
  if (dedicated && selectedPlugin) {
    for (const model of (draft.models || '').split(/[\n,]/).map((value) => value.trim())) {
      if (selectedPlugin.models.includes(model)) priceModels.add(model)
    }
  }
  const base = draft.base_url?.trim() || (dedicated ? selectedPlugin?.baseUrl : '')
  const trust = dedicated ? assessBaseUrlTrust(base) : null
  function choose(keys: string[]) {
    const changes: Partial<ChannelDraft> = { setting: channelPluginSetting(draft.setting, draft.type!, keys) }
    if (dedicated) {
      const plugin = plugins.find((item) => item.key === keys[0]),
        next = nextTaskPluginBaseUrl(draft.base_url || '', selectedPlugin?.baseUrl, plugin?.baseUrl)
      if (next !== null) changes.base_url = next
    }
    patch(changes)
  }
  if (query.isSuccess && !dedicated && !gateway && !extensions.length) return null
  return (
    <fieldset className="channel-plugin-fields admin-wide">
      <legend>{t(gateway ? 'Upstream task plugins' : 'Task plugins')}</legend>
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : parseError ? (
        <p role="alert">{t(parseError)}</p>
      ) : (
        <>
          {dedicated && (
            <label className="field">
              <span>{t('Task plugin')}</span>
              <select required value={selected[0] || ''} onChange={(event) => choose(event.target.value ? [event.target.value] : [])}>
                <option value="" disabled>
                  {t('Select')}
                </option>
                {selected
                  .filter((key) => !plugins.some((plugin) => plugin.key === key))
                  .map((key) => (
                    <option key={key} value={key}>
                      {key} · {t('Unavailable')}
                    </option>
                  ))}
                {plugins.map((plugin) => (
                  <option key={plugin.key} value={plugin.key}>
                    {plugin.name} · {plugin.key}
                  </option>
                ))}
              </select>
            </label>
          )}
          {gateway && (
            <>
              <p className="small-note">
                {t('This channel serves the models of every selected plugin. The upstream New API gateway must have the same plugins installed.')}
              </p>
              <div className="channel-plugin-options">
                {[...new Set([...selected, ...options.map((plugin) => plugin.key)])].map((key) => {
                  const plugin = options.find((item) => item.key === key)
                  return (
                    <label className="checkbox-label" key={key}>
                      <input
                        type="checkbox"
                        checked={selected.includes(key)}
                        onChange={(event) => choose(event.target.checked ? [...selected, key] : selected.filter((value) => value !== key))}
                      />
                      {plugin?.name || key}
                      {!plugin && ` · ${t('Unavailable')}`}
                    </label>
                  )
                })}
              </div>
            </>
          )}
          {dedicated && selectedPlugin?.baseUrl && (
            <p className="small-note">
              {t('Plugin default Base URL')}: <code>{selectedPlugin.baseUrl}</code>
            </p>
          )}
          {trust && (trust.plainHttp || trust.privateHost) && (
            <p className="small-note">
              {t('Review the plugin upstream address before sending credentials.')} <code>{base}</code>
            </p>
          )}
          <div className="channel-plugin-models">
            {(gateway ? gatewayPlugins : shown).map((plugin) => (
              <div key={plugin.key}>
                <span>{plugin.name}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!plugin.models?.length}
                  onClick={() =>
                    patch({
                      models: [
                        ...new Set([...(draft.models || '').split(/[\n,]/), ...(plugin.models || [])].map((model) => model.trim()).filter(Boolean)),
                      ].join(','),
                    })
                  }
                >
                  {t('Add models')}
                </Button>
              </div>
            ))}
          </div>
          {priceModels.size > 0 && (
            <details className="admin-advanced">
              <summary>{t('Route prices')}</summary>
              <p className="small-note">{t('These are base USD prices before group discounts and currency conversion.')}</p>
              {[...priceModels].map((model) => (
                <label className="field" key={model}>
                  <span>
                    {model} · {t('Billing expression')}
                  </span>
                  <Textarea
                    rows={3}
                    spellCheck={false}
                    placeholder={t('Inherited')}
                    value={Object.hasOwn(channelPrices, model) ? channelPrices[model] : ''}
                    onChange={(event) => {
                      const expression = event.target.value
                      const next = { ...channelPrices, [model]: expression }
                      if (!expression.trim()) delete next[model]
                      patch({
                        setting: channelSettingsPatch(draft.setting, { task_billing_expressions: Object.keys(next).length ? next : undefined }),
                      })
                    }}
                  />
                </label>
              ))}
            </details>
          )}
        </>
      )}
    </fieldset>
  )
}
