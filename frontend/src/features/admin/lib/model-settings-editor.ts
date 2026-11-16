import { isRecord } from './settings-collections'

export const modelListKeys = new Set(['global.thinking_model_blacklist', 'global.effort_tail_model_ids', 'gemini.supported_imagine_models'])
export const modelEditorKeys = new Set([
  ...modelListKeys,
  'global.chat_completions_to_responses_policy',
  'claude.model_headers_settings',
  'claude.default_max_tokens',
  'gemini.safety_settings',
  'gemini.version_settings',
  'tool_price_setting.prices',
])
export const safetyThresholds = [
  '',
  'OFF',
  'BLOCK_NONE',
  'BLOCK_ONLY_HIGH',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_LOW_AND_ABOVE',
  'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
]

export function parseModelSetting(key: string, source: string): string[] | Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(source || (modelListKeys.has(key) ? '[]' : '{}'))
    if (modelListKeys.has(key) && Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
    if (!isRecord(value)) return null
    if (key === 'global.chat_completions_to_responses_policy') {
      if (['enabled', 'all_channels'].some((flag) => value[flag] !== undefined && typeof value[flag] !== 'boolean')) return null
      if (
        ['channel_ids', 'channel_types'].some(
          (field) =>
            value[field] !== undefined && (!Array.isArray(value[field]) || value[field].some((item) => typeof item !== 'number' && item !== ''))
        )
      )
        return null
      if (
        value.model_patterns !== undefined &&
        (!Array.isArray(value.model_patterns) || value.model_patterns.some((item) => typeof item !== 'string'))
      )
        return null
      return value
    }
    if (
      key === 'claude.model_headers_settings' &&
      Object.values(value).every(
        (headers) =>
          isRecord(headers) && Object.values(headers).every((items) => Array.isArray(items) && items.every((item) => typeof item === 'string'))
      )
    )
      return value
    if (key === 'tool_price_setting.prices' && Object.values(value).every((item) => typeof item === 'number' || item === '')) return value
    if (key === 'claude.default_max_tokens' && Object.values(value).every((item) => typeof item === 'number' || item === '')) return value
    if (key === 'gemini.version_settings' && Object.values(value).every((item) => typeof item === 'string')) return value
    if (key === 'gemini.safety_settings' && Object.values(value).every((item) => typeof item === 'string' && safetyThresholds.includes(item)))
      return value
  } catch {
    /* Preserve unsupported drafts in the raw editor. */
  }
  return null
}

export function modelMappingRecord(rows: [string, unknown][]): Record<string, unknown> | null {
  const keys = rows.map(([key]) => key)
  if (keys.some((key) => !key.trim()) || new Set(keys).size !== keys.length) return null
  return Object.fromEntries(rows)
}
