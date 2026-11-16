import type { UsageLog } from '@/lib/api/types'

export interface LogFilters {
  start: string
  end: string
  type: string
  username: string
  token_name: string
  model_name: string
  channel: string
  request_id: string
  upstream_request_id: string
  group: string
}

export interface LogLink {
  page: number
  size: number
  scope: 'self' | 'all'
  filters: LogFilters
}

export interface AffinityTarget {
  rule_name: string
  using_group: string
  key_fp: string
  key_hint: string
}

export interface LogRow {
  id: number
  user_id: number
  created_at: number
  type: number
  content: string
  username: string
  token_name: string
  model_name: string
  quota: number
  prompt_tokens: number
  completion_tokens: number
  use_time: number
  is_stream: boolean
  channel: number
  channel_name?: string
  group: string
  request_id?: string
  upstream_request_id?: string
  other?: string
}

export const LOG_TYPES: { value: string; label: string }[] = [
  { value: '2', label: 'Consume' },
  { value: '1', label: 'Top up' },
  { value: '3', label: 'Manage' },
  { value: '4', label: 'System' },
]

export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function initialLogFilters(now: Date = new Date()): LogFilters {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return {
    start: toLocalInput(start),
    end: toLocalInput(now),
    type: '',
    username: '',
    token_name: '',
    model_name: '',
    channel: '',
    request_id: '',
    upstream_request_id: '',
    group: '',
  }
}

export function readLogLink(query: string): LogLink {
  const params = new URLSearchParams(query)
  const defaults = initialLogFilters()
  const page = Number(params.get('page'))
  const size = Number(params.get('pageSize') || params.get('page_size'))
  const filters: LogFilters = {
    start:
      params.get('start') ||
      (params.has('startTime') && Number.isFinite(Number(params.get('startTime')))
        ? toLocalInput(new Date(Number(params.get('startTime'))))
        : defaults.start),
    end:
      params.get('end') ||
      (params.has('endTime') && Number.isFinite(Number(params.get('endTime')))
        ? toLocalInput(new Date(Number(params.get('endTime'))))
        : defaults.end),
    type: params.getAll('type').length > 1 ? '0' : params.get('type') || '',
    username: params.get('username') || '',
    token_name: params.get('tokenName') || params.get('token') || '',
    model_name: params.get('modelName') || params.get('model') || '',
    channel: params.get('channel') || '',
    request_id: params.get('requestId') || '',
    upstream_request_id: params.get('upstreamRequestId') || '',
    group: params.get('group') || '',
  }
  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    size: Number.isFinite(size) && size > 0 ? Math.floor(size) : 20,
    scope: params.get('scope') === 'self' ? 'self' : 'all',
    filters,
  }
}

export function buildLogParams(filters: LogFilters, admin: boolean, stats = false): URLSearchParams {
  const params = logParams(filters, 1, 20, admin)
  params.delete('p')
  params.delete('page_size')
  if (filters.group.trim()) params.set('group', filters.group.trim())
  if (!stats && filters.upstream_request_id.trim()) params.set('upstream_request_id', filters.upstream_request_id.trim())
  if (stats) {
    params.delete('type')
    params.delete('request_id')
    params.delete('upstream_request_id')
  }
  return params
}

export const logTypeLabels: Record<number, string> = {
  1: 'Top up',
  2: 'Consume',
  3: 'Manage',
  4: 'System',
  5: 'Error',
  6: 'Refund',
}

export function logOther(log: UsageLog): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(log.other || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function logAffinity(log: UsageLog): AffinityTarget | null {
  const other = logOther(log)
  const admin = other.admin_info
  if (!admin || typeof admin !== 'object' || Array.isArray(admin)) return null
  const affinity = (admin as Record<string, unknown>).channel_affinity
  if (!affinity || typeof affinity !== 'object' || Array.isArray(affinity)) return null
  const value = affinity as Record<string, unknown>
  const group = value.using_group ?? value.selected_group
  if (
    typeof value.rule_name !== 'string' ||
    !value.rule_name ||
    typeof value.key_fp !== 'string' ||
    !value.key_fp ||
    typeof group !== 'string' ||
    !group
  )
    return null
  return { rule_name: value.rule_name, key_fp: value.key_fp, using_group: group, key_hint: typeof value.key_hint === 'string' ? value.key_hint : '' }
}

export function logParams(filters: LogFilters, page: number, size: number, admin: boolean): URLSearchParams {
  const start = Math.floor(new Date(filters.start).getTime() / 1000)
  const end = Math.floor(new Date(filters.end).getTime() / 1000)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('Invalid time range')
  const params = new URLSearchParams({ p: String(page), page_size: String(size), start_timestamp: String(start), end_timestamp: String(end) })
  if (filters.type) params.set('type', filters.type)
  for (const [source, target] of [
    ['token_name', 'token_name'],
    ['model_name', 'model_name'],
    ['request_id', 'request_id'],
    ['upstream_request_id', 'upstream_request_id'],
    ['group', 'group'],
  ] as const)
    if (filters[source].trim()) params.set(target, filters[source].trim())
  if (admin) {
    if (filters.username.trim()) params.set('username', filters.username.trim())
    if (filters.channel.trim()) params.set('channel', filters.channel.trim())
  }
  return params
}

export function logLink(filters: LogFilters, page: number, size: number, all: boolean): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(size),
    scope: all ? 'all' : 'self',
    start: filters.start,
    end: filters.end,
  })
  for (const [source, target] of [
    ['type', 'type'],
    ['username', 'username'],
    ['token_name', 'tokenName'],
    ['model_name', 'model'],
    ['channel', 'channel'],
    ['request_id', 'requestId'],
    ['upstream_request_id', 'upstreamRequestId'],
    ['group', 'group'],
  ] as const)
    if (filters[source].trim()) params.set(target, filters[source].trim())
  return params.toString()
}
