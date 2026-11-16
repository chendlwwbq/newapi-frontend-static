'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminConfirm } from './shared'
import { channelProviderSettings } from './lib/channel-provider'
import {
  ADVANCED_CUSTOM_INCOMING_PATH_OPTIONS,
  ADVANCED_CUSTOM_AUTH_MODE_OPTIONS,
  ADVANCED_CUSTOM_TEMPLATE_OPTIONS,
  createAdvancedCustomRoute,
  createAdvancedCustomConfig,
  getAdvancedCustomTemplateConfig,
  getAdvancedCustomConverterOptions,
  getAdvancedCustomConverterDefaults,
  getAdvancedCustomAuthMode,
  buildAdvancedCustomAuth,
  isAdvancedCustomManagementPath,
  parseAdvancedCustomConfig,
  validateAdvancedCustomConfig,
  type AdvancedCustomAuthMode,
} from './lib/advanced-custom'
import type { AdvancedCustomConfig, AdvancedCustomRoute, AdvancedCustomConverter } from './lib/advanced-custom-types'
import type { ChannelDraft } from './lib/channel-form'

export function AdvancedChannelFields({ draft, patch }: { draft: ChannelDraft; patch: (value: Partial<ChannelDraft>) => void }) {
  const { t } = useTranslation(),
    [template, setTemplate] = useState<string | null>(null)
  if (draft.type !== 58) return null
  let settings: Record<string, unknown> = {},
    config: AdvancedCustomConfig | null = null,
    error = ''
  try {
    settings = channelProviderSettings(draft.settings)
    config = parseAdvancedCustomConfig(JSON.stringify(settings.advanced_custom))
  } catch {
    error = 'Invalid JSON object'
  }
  const routes = config?.advanced_routes || [],
    validation = validateAdvancedCustomConfig(config)
  function update(next: AdvancedCustomConfig) {
    patch({ settings: JSON.stringify({ ...settings, advanced_custom: next }) })
  }
  function routeAt(index: number, next: Partial<AdvancedCustomRoute>) {
    update({ advanced_routes: routes.map((route, position) => (position === index ? { ...route, ...next } : route)) })
  }
  function move(index: number, delta: number) {
    const next = [...routes]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    update({ advanced_routes: next })
  }
  return (
    <fieldset className="channel-provider-fields advanced-channel-fields admin-wide">
      <legend>{t('Advanced custom routes')}</legend>
      <p className="small-note admin-wide">
        {t('Routes are evaluated in order. Model rules use exact names or re: patterns; keep the catch-all route last.')}
      </p>
      {error ? (
        <p role="alert">{t(error)}</p>
      ) : (
        <>
          <div className="action-buttons admin-wide">
            {ADVANCED_CUSTOM_TEMPLATE_OPTIONS.map((option) => (
              <Button
                type="button"
                variant="outline"
                key={option.value}
                onClick={() => {
                  if (routes.length) setTemplate(option.value)
                  else update(getAdvancedCustomTemplateConfig(option.value) || createAdvancedCustomConfig())
                }}
              >
                {t(option.label)}
              </Button>
            ))}
          </div>
          {!config && settings.advanced_custom !== undefined && (
            <p role="alert" className="admin-wide">
              {t('Invalid JSON object')}
            </p>
          )}
          <datalist id="advanced-channel-paths">
            {ADVANCED_CUSTOM_INCOMING_PATH_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.value}
              </option>
            ))}
          </datalist>
          {routes.map((route, index) => {
            const converter = route.converter || 'none',
              mode = getAdvancedCustomAuthMode(route),
              management = isAdvancedCustomManagementPath(route.incoming_path || ''),
              options = getAdvancedCustomConverterOptions(route.incoming_path || '')
            return (
              <section className="advanced-channel-route admin-wide" key={index} aria-label={`${t('Route')} ${index + 1}`}>
                <div className="advanced-channel-route-heading">
                  <h3>
                    {t('Route')} {index + 1}
                  </h3>
                  <div className="action-buttons">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`${t('Move up')} ${index + 1}`}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === routes.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`${t('Move down')} ${index + 1}`}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        update({
                          advanced_routes: routes.flatMap((value, position) => (position === index ? [value, structuredClone(value)] : [value])),
                        })
                      }
                    >
                      {t('Duplicate')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => update({ advanced_routes: routes.filter((_, position) => position !== index) })}
                    >
                      {t('Remove')}
                    </Button>
                  </div>
                </div>
                <div className="admin-form-grid">
                  <label className="field">
                    <span>{t('Incoming path')}</span>
                    <Input
                      required
                      list="advanced-channel-paths"
                      value={route.incoming_path || ''}
                      onChange={(event) => routeAt(index, { incoming_path: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>{t('Converter')}</span>
                    <select
                      value={converter}
                      onChange={(event) => {
                        const value = event.target.value as AdvancedCustomConverter
                        routeAt(index, {
                          converter: value,
                          ...getAdvancedCustomConverterDefaults(value, route.incoming_path || ''),
                          pass_through_body_enabled: false,
                        })
                      }}
                    >
                      {!options.some((option) => option.value === converter) && <option value={converter}>{converter}</option>}
                      {options.map((option) => (
                        <option value={option.value} key={option.value}>
                          {t(option.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field admin-wide">
                    <span>{t('Upstream path')}</span>
                    <Input
                      required
                      value={route.upstream_path || ''}
                      placeholder="/v1/chat/completions"
                      onChange={(event) => routeAt(index, { upstream_path: event.target.value })}
                    />
                    <small>{t('Use a full URL or a path relative to Base URL. {model} and {api_key} are native placeholders.')}</small>
                  </label>
                  {!management && (
                    <label className="field admin-wide">
                      <span>{t('Client model rules')}</span>
                      <Input
                        key={JSON.stringify(route.models)}
                        defaultValue={(route.models || []).join(',')}
                        placeholder="gpt-4o,re:^claude-"
                        onBlur={(event) => routeAt(index, { models: event.target.value.split(',') })}
                      />
                      <small>{t('Leave empty for the catch-all route. Rules match client model names before model mapping.')}</small>
                    </label>
                  )}
                  <label className="field">
                    <span>{t('Authentication')}</span>
                    <select
                      value={mode}
                      onChange={(event) =>
                        routeAt(index, { auth: buildAdvancedCustomAuth(event.target.value as AdvancedCustomAuthMode, route.auth) })
                      }
                    >
                      {ADVANCED_CUSTOM_AUTH_MODE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>
                          {t(option.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(mode === 'header' || mode === 'query') && (
                    <>
                      <label className="field">
                        <span>{t('Auth name')}</span>
                        <Input
                          required
                          value={route.auth?.name || ''}
                          onChange={(event) => routeAt(index, { auth: { ...route.auth, name: event.target.value } })}
                        />
                      </label>
                      <label className="field admin-wide">
                        <span>{t('Auth value')}</span>
                        <Input
                          required
                          autoComplete="off"
                          spellCheck={false}
                          value={route.auth?.value || ''}
                          onChange={(event) => routeAt(index, { auth: { ...route.auth, value: event.target.value } })}
                        />
                      </label>
                    </>
                  )}
                  {!management && (
                    <label className="checkbox-label admin-wide">
                      <input
                        type="checkbox"
                        disabled={converter !== 'none'}
                        checked={route.pass_through_body_enabled === true}
                        onChange={(event) => routeAt(index, { pass_through_body_enabled: event.target.checked })}
                      />
                      {t('Pass-through body')}
                    </label>
                  )}
                </div>
                {validation?.routeIndex === index && (
                  <p className="inline-error" role="alert">
                    {t(validation.message)}
                  </p>
                )}
              </section>
            )
          })}
          <Button type="button" variant="outline" onClick={() => update({ advanced_routes: [...routes, createAdvancedCustomRoute()] })}>
            {t('Add route')}
          </Button>
          {validation && validation.routeIndex === undefined && <p className="small-note admin-wide">{t(validation.message)}</p>}
        </>
      )}
      {template && (
        <AdminConfirm
          title={t('Replace routes')}
          description={t('The selected template replaces all current routes in this draft.')}
          busy={false}
          onClose={() => setTemplate(null)}
          onConfirm={() => {
            update(getAdvancedCustomTemplateConfig(template) || createAdvancedCustomConfig())
            setTemplate(null)
          }}
        />
      )}
    </fieldset>
  )
}
