import { expect, it } from 'vitest'
import { drawingParams, initialTaskFilters, readTaskLink, taskLink, taskParams } from '../lib/task-filters'

it('uses native page_size and includes action, platform, status and exact time boundaries', () => {
  const filters = {
    ...initialTaskFilters(),
    start: '2026-10-26T00:00',
    end: '2026-10-27T00:00',
    action: ' GENERATE ',
    platform: 'fixture',
    status: 'SUCCESS',
  }
  const query = taskParams(filters, 2, 50, false)
  expect(query.get('page_size')).toBe('50')
  expect(query.get('p')).toBe('2')
  expect(query.has('size')).toBe(false)
  expect(query.get('action')).toBe('GENERATE')
  expect(query.get('platform')).toBe('fixture')
  expect(query.get('status')).toBe('SUCCESS')
  expect(Number(query.get('start_timestamp'))).toBe(new Date(filters.start).getTime() / 1000)
})
it('excludes administrator-only channel filtering from personal requests', () => {
  const filters = { ...initialTaskFilters(), channel_id: '42' }
  expect(taskParams(filters, 1, 20, false).has('channel_id')).toBe(false)
  expect(taskParams(filters, 1, 20, true).get('channel_id')).toBe('42')
})
it('rejects invalid and reversed dates before querying the native API', () => {
  expect(() => taskParams({ ...initialTaskFilters(), start: 'bad' }, 1, 20, false)).toThrow('Invalid time range')
  expect(() => taskParams({ ...initialTaskFilters(), start: '2026-12-01', end: '2026-01-01' }, 1, 20, false)).toThrow('Invalid time range')
})
it('uses millisecond timestamps and the Midjourney filter while protecting admin-only fields', () => {
  const filters = { ...initialTaskFilters(), start: '2026-10-26T00:00', end: '2026-10-27T00:00', task_id: ' abc/1 ', channel_id: '42' }
  const personal = drawingParams(filters, 2, 50, false)
  expect(Number(personal.get('start_timestamp'))).toBe(new Date(filters.start).getTime())
  expect(personal.get('mj_id')).toBe('abc/1')
  expect(personal.has('task_id')).toBe(false)
  expect(personal.has('channel_id')).toBe(false)
  expect(drawingParams(filters, 2, 50, true).get('channel_id')).toBe('42')
})
it('restores and shares task filters using the former link format', () => {
  const link = readTaskLink('filter=task%2F1&channel=42&platform=test&status=SUCCESS&page=2&pageSize=30')
  expect(link).toMatchObject({
    page: 2,
    size: 30,
    scope: 'all',
    filters: { task_id: 'task/1', channel_id: '42', platform: 'test', status: 'SUCCESS' },
  })
  const query = new URLSearchParams(taskLink(link.filters, link.page, link.size, true))
  expect(query.get('filter')).toBe('task/1')
  expect(query.get('channel')).toBe('42')
  expect(new URLSearchParams(taskLink(link.filters, 1, 30, false)).has('channel')).toBe(false)
})
