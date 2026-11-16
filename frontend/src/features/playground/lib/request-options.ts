import type { ChatCompletionRequest, ParameterEnabled, PlaygroundConfig } from '../types'
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import { PLAYGROUND_PARAMETER_CONTROLS, normalizeParameterNumberValue } from './parameters'

export function requestParameters(config: PlaygroundConfig, enabled: ParameterEnabled): Partial<ChatCompletionRequest> {
  const result: Partial<ChatCompletionRequest> = { stream: config.stream }
  for (const control of PLAYGROUND_PARAMETER_CONTROLS) {
    const value = config[control.key]
    if (enabled[control.key] && value !== null) result[control.key] = normalizeParameterNumberValue(control.key, value) ?? undefined
  }
  return result
}

export function savedPlaygroundSettings(value: string | null) {
  const config = { ...DEFAULT_CONFIG },
    enabled = { ...DEFAULT_PARAMETER_ENABLED }
  let system = ''
  try {
    const saved = JSON.parse(value || '{}')
    if (typeof saved.system === 'string') system = saved.system
    if (typeof saved.config?.stream === 'boolean') config.stream = saved.config.stream
    for (const control of PLAYGROUND_PARAMETER_CONTROLS) {
      const next = saved.config?.[control.key]
      if (typeof next === 'number' && Number.isFinite(next))
        Object.assign(config, { [control.key]: normalizeParameterNumberValue(control.key, next) })
      if (typeof saved.enabled?.[control.key] === 'boolean') enabled[control.key] = saved.enabled[control.key]
    }
  } catch {
    /* Keep native defaults if device storage is unavailable or predates this schema. */
  }
  return { config, enabled, system }
}
