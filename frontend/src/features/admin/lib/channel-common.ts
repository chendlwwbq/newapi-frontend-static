import type { ChannelDraft } from './channel-form'
import { channelProviderSettings } from './channel-provider'
import { parseAdvancedCustomConfig, hasValidAdvancedCustomModelListRoute } from './advanced-custom'

// Matches native model discovery and Responses WebSocket channel allow lists.
export const MODEL_UPDATE_TYPES = new Set([1, 4, 14, 17, 20, 23, 24, 25, 26, 27, 31, 34, 35, 40, 42, 43, 47, 48, 57, 58, 59, 60, 62, 63])
export function channelSupportsWebSocket(type: number) {
  return [1, 57, 58, 59, 60].includes(type)
}

/** Patch one of the native JSON objects without replacing bindings or extension fields. */
export function channelSettingsPatch(value: string | null | undefined, patch: Record<string, unknown>): string {
  const settings = channelProviderSettings(value)
  for (const [key, next] of Object.entries(patch)) {
    if (next === undefined) delete settings[key]
    else settings[key] = next
  }
  return JSON.stringify(settings)
}

export function channelProtocolPatch(value: string | null | undefined, protocol: string): string {
  if (protocol === 'http1') return channelSettingsPatch(value, { http_protocol: 'http1', http2_connection_shards: undefined })
  return channelSettingsPatch(value, { http_protocol: undefined })
}

export function channelModelCheckPatch(value: string | null | undefined, enabled: boolean): string {
  if (enabled) return channelSettingsPatch(value, { upstream_model_update_check_enabled: true })
  return channelSettingsPatch(value, {
    upstream_model_update_check_enabled: false,
    upstream_model_update_auto_sync_enabled: false,
    upstream_model_update_last_detected_models: [],
  })
}

export function channelModelChecksAvailable(type: number, settings: string | null | undefined): boolean {
  if (!MODEL_UPDATE_TYPES.has(type)) return false
  if (type !== 58) return true
  return hasValidAdvancedCustomModelListRoute(parseAdvancedCustomConfig(JSON.stringify(channelProviderSettings(settings).advanced_custom)))
}

export function channelIgnoredModels(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((model) => model.trim())
        .filter(Boolean)
    ),
  ]
}

/** Same proxy URL syntax as the native form; errors never include a credential-bearing URL. */
export function channelProxyValid(value: string): boolean {
  const input = value.trim()
  if (!input) return true
  const separator = input.indexOf('://')
  if (separator <= 0) return false
  const remainder = input.slice(separator + 3),
    suffix = remainder.search(/[/?#]/)
  if (suffix >= 0 && remainder.slice(suffix) !== '/') return false
  try {
    const url = new URL(input)
    return ['http:', 'https:', 'socks5:', 'socks5h:'].includes(url.protocol) && !!url.hostname && url.port !== '0'
  } catch {
    return false
  }
}

export function channelCommonRequest(draft: ChannelDraft): Partial<ChannelDraft> {
  if (draft.setting === undefined || draft.setting === null || !draft.setting.trim()) return {}
  const setting = channelProviderSettings(draft.setting)
  const protocol = typeof setting.http_protocol === 'string' ? setting.http_protocol.trim().toLowerCase() : setting.http_protocol
  if (protocol !== undefined && !['', 'auto', 'http1'].includes(protocol as string)) throw new Error('HTTP protocol must be Auto or HTTP/1.1')
  const shards = setting.http2_connection_shards
  if (shards !== undefined && (typeof shards !== 'number' || !Number.isInteger(shards) || shards < 0 || shards > 8))
    throw new Error('HTTP/2 connection shards must be between 1 and 8')
  if (protocol === 'http1' && typeof shards === 'number' && shards > 1)
    throw new Error('HTTP/2 connection shards must be 1 when HTTP/1.1 is selected')
  if (setting.proxy !== undefined) {
    if (typeof setting.proxy !== 'string' || !channelProxyValid(setting.proxy))
      throw new Error('Proxy address must use HTTP, HTTPS, SOCKS5, or SOCKS5H and include a valid host')
    setting.proxy = setting.proxy.trim()
  }
  if (setting.responses_websocket_enabled === true && !channelSupportsWebSocket(draft.type || 0)) setting.responses_websocket_enabled = false
  return { setting: JSON.stringify(setting) }
}
