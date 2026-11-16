import { initialLogFilters, readLogLink } from '@/features/logs/contracts'
import { TASK_STATUS } from '../constants'

export interface TaskFilters {
  start: string
  end: string
  task_id: string
  platform: string
  action: string
  status: string
  channel_id: string
}
export function initialTaskFilters(): TaskFilters {
  const { start, end } = initialLogFilters()
  return { start, end, task_id: '', platform: '', action: '', status: '', channel_id: '' }
}
export function readTaskLink(query: string) {
  const base = readLogLink(query),
    params = new URLSearchParams(query)
  const status = params.get('status') || ''
  const filters: TaskFilters = {
    start: base.filters.start,
    end: base.filters.end,
    task_id: params.get('filter') || '',
    channel_id: base.filters.channel,
    platform: params.get('platform') || '',
    action: params.get('action') || '',
    status: Object.values(TASK_STATUS).includes(status as (typeof TASK_STATUS)[keyof typeof TASK_STATUS]) ? status : '',
  }
  return { ...base, filters }
}
export function taskLink(filters: TaskFilters, page: number, size: number, all: boolean) {
  const params = new URLSearchParams({
    startTime: String(new Date(filters.start).getTime()),
    endTime: String(new Date(filters.end).getTime()),
    page: String(page),
    pageSize: String(size),
    scope: all ? 'all' : 'self',
  })
  for (const [source, target] of [
    ['task_id', 'filter'],
    ['platform', 'platform'],
    ['action', 'action'],
    ['status', 'status'],
  ] as const)
    if (filters[source].trim()) params.set(target, filters[source].trim())
  if (all && filters.channel_id.trim()) params.set('channel', filters.channel_id.trim())
  return params.toString()
}
export function taskParams(filters: TaskFilters, page: number, size: number, admin: boolean) {
  const start = Math.floor(new Date(filters.start).getTime() / 1000),
    end = Math.floor(new Date(filters.end).getTime() / 1000)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('Invalid time range')
  const params = new URLSearchParams({ p: String(page), page_size: String(size), start_timestamp: String(start), end_timestamp: String(end) })
  const fields: (keyof TaskFilters)[] = ['task_id', 'platform', 'action', 'status']
  if (admin) fields.push('channel_id')
  for (const field of fields) if (filters[field].trim()) params.set(field, filters[field].trim())
  return params
}
export function drawingParams(filter: TaskFilters, page: number, size: number, admin: boolean) {
  const params = taskParams(filter, page, size, admin)
  params.set('start_timestamp', String(Number(params.get('start_timestamp')) * 1000))
  params.set('end_timestamp', String(Number(params.get('end_timestamp')) * 1000))
  params.delete('task_id')
  if (filter.task_id.trim()) params.set('mj_id', filter.task_id.trim())
  return params
}
