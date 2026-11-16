export type ChannelTagChanges = {
  new_tag?: string
  priority?: string
  weight?: string
  models?: string
  groups?: string
  model_mapping?: string
  param_override?: string
  header_override?: string
}

// Only explicitly selected fields affect all channels in the tag.
export function channelTagRequest(tag: string, changes: ChannelTagChanges, sensitive: boolean) {
  const body: Record<string, string | number> = { tag: tag.trim() }
  if (!body.tag) throw new Error('Tag cannot be empty')
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue
    if ((key === 'param_override' || key === 'header_override') && !sensitive) continue
    if (key === 'priority' || key === 'weight') {
      const number = Number(value)
      if (!value.trim() || !Number.isSafeInteger(number) || (key === 'weight' && number < 0)) throw new Error('Invalid parameters')
      body[key] = number
    } else if (['model_mapping', 'param_override', 'header_override'].includes(key)) {
      if (value.trim()) {
        const parsed = JSON.parse(value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object')
      }
      body[key] = value.trim()
    } else if (key === 'models' || key === 'groups')
      body[key] = [
        ...new Set(
          value
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ].join(',')
    else if (key === 'new_tag') body[key] = value.trim()
  }
  if (Object.keys(body).length === 1) throw new Error('No changes made')
  return body
}

export interface ChannelKeyStatus {
  index: number
  status: number
  disabled_time?: number
  reason?: string
  key_preview?: string
}
export interface ChannelKeyPage {
  keys: ChannelKeyStatus[] | null
  total: number
  page: number
  page_size: number
  total_pages: number
  enabled_count: number
  manual_disabled_count: number
  auto_disabled_count: number
}
export type ChannelKeyAction = 'enable_key' | 'disable_key' | 'delete_key' | 'enable_all_keys' | 'disable_all_keys' | 'delete_disabled_keys'

export function channelKeyRequest(channelId: number, action: ChannelKeyAction, index?: number) {
  if (action.endsWith('_key')) {
    if (index === undefined || !Number.isSafeInteger(index) || index < 0) throw new Error('Key index out of range')
    return { channel_id: channelId, action, key_index: index }
  }
  return { channel_id: channelId, action }
}
