export type ChannelPluginOption = {
  key: string
  name: string
  description?: Record<string, string> | null
  baseUrl?: string
  models: string[]
  channelTypes?: number[] | null
  upstreams?: string[] | null
}

export function channelPluginKeys(setting: string | null | undefined): string[] {
  const value = JSON.parse(setting || '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JSON object')
  const keys = Array.isArray(value.task_extend_plugin_keys) ? value.task_extend_plugin_keys : []
  return [
    ...new Set([value.task_plugin_key, ...keys].filter((key): key is string => typeof key === 'string' && !!key.trim()).map((key) => key.trim())),
  ]
}

export function channelPluginSetting(setting: string | null | undefined, type: number, keys: string[]): string {
  const value = JSON.parse(setting || '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JSON object')
  const selected = [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
  if (type === 61) {
    if (selected.length !== 1) throw new Error('Task plugin is required')
    value.task_plugin_key = selected[0]
    delete value.task_extend_plugin_keys
  } else if (type === 60) {
    value.task_plugin_key = ''
    value.task_extend_plugin_keys = selected
  } else throw new Error('Invalid parameters')
  return JSON.stringify(value, null, 2)
}
