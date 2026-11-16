import type { Channel } from '../types'
import { channelProviderRequest } from './channel-provider'
import { channelCommonRequest } from './channel-common'

export type ChannelDraft = Partial<Channel> & { mode: string; key_mode: string; multi_key_mode: string }
export const newChannel: ChannelDraft = {
  name: '',
  type: 1,
  key: '',
  models: '',
  group: 'default',
  base_url: '',
  priority: 0,
  weight: 1,
  auto_ban: 1,
  tag: '',
  remark: '',
  mode: 'single',
  key_mode: 'append',
  multi_key_mode: 'random',
}
const editable = [
  'name',
  'models',
  'group',
  'priority',
  'weight',
  'auto_ban',
  'tag',
  'remark',
  'test_model',
  'model_mapping',
  'status_code_mapping',
] as const
const sensitive = ['type', 'base_url', 'openai_organization', 'other', 'setting', 'settings', 'param_override', 'header_override'] as const

// Never echo read-only status, quota, channel_info or a blank replacement key.
export function channelRequest(draft: ChannelDraft, sensitiveWrite: boolean) {
  if (sensitiveWrite) draft = { ...draft, ...channelProviderRequest(draft), ...channelCommonRequest(draft) }
  const body: Record<string, unknown> = {}
  for (const key of editable) if (draft[key] !== undefined) body[key] = draft[key]
  if (sensitiveWrite) {
    for (const key of sensitive) if (draft[key] !== undefined) body[key] = draft[key]
    if (draft.key?.trim()) {
      body.key = draft.key.trim()
      if (draft.id) body.key_mode = draft.key_mode
    }
  }
  body.models = String(draft.models || '')
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .join(',')
  body.group = String(draft.group || 'default')
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .join(',')
  if (draft.id) return { ...body, id: draft.id, ...(sensitiveWrite ? { multi_key_mode: draft.multi_key_mode } : {}) }
  return { mode: draft.mode, multi_key_mode: draft.multi_key_mode, channel: body }
}
