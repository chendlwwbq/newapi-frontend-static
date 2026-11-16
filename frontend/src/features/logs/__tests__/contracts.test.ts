import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/auth/session', () => ({ freshAuthHeaders: async () => ({}) }))
import { buildLogParams, initialLogFilters, readLogLink, logParams, logAffinity, logOther } from '../contracts'
import { readLogExport, toCsvLine, getLogCsvHeader, getLogCsvRow, exportLogs } from '../export'
import type { UsageLog } from '@/lib/api/types'

const filters = {
  ...initialLogFilters(),
  start: '2026-10-20T00:00',
  end: '2026-10-27T23:59',
  username: 'other-user',
  channel: '12',
  model_name: ' model ',
  type: '5',
  request_id: 'request/a?b',
  upstream_request_id: 'upstream-id',
}
const log = {
  id: 1,
  type: 2,
  created_at: 1,
  username: 'user',
  channel: 12,
  channel_name: 'native',
  token_name: 'key',
  model_name: 'model',
  group: 'default',
  quota: 100,
  prompt_tokens: 3,
  completion_tokens: 2,
  use_time: 0,
  is_stream: true,
  content: '=SUM(A1)',
  other: '{"cache_creation_tokens_5m":2,"cache_creation_tokens_1h":3}',
} as UsageLog

describe('native log filters and role projections', () => {
  it('restores former log bookmarks and preserves their time and pagination semantics', () => {
    const start = new Date(2026, 9, 20, 9, 10, 15).getTime(),
      end = new Date(2026, 9, 21, 10, 11, 25).getTime()
    const search = new URLSearchParams({
      startTime: String(start),
      endTime: String(end),
      model: 'model/a',
      token: 'key',
      group: 'vip',
      username: 'alice',
      channel: '7',
      requestId: 'req-a',
      upstreamRequestId: 'req-b',
      type: '5',
      page: '2',
      pageSize: '50',
    })
    const link = readLogLink(search.toString()),
      params = buildLogParams(link.filters, true)
    expect(link).toMatchObject({ page: 2, size: 50, filters: { model_name: 'model/a', token_name: 'key', type: '5' } })
    expect(params.get('start_timestamp')).toBe(String(start / 1000))
    expect(params.get('end_timestamp')).toBe(String(end / 1000))
    expect(params.get('request_id')).toBe('req-a')
    expect(params.get('upstream_request_id')).toBe('req-b')
    const listParams = logParams(link.filters, link.page, link.size, true)
    expect(listParams.get('group')).toBe('vip')
    expect(listParams.get('upstream_request_id')).toBe('req-b')
    expect(listParams.get('p')).toBe('2')
    expect(params.get('username')).toBe('alice')
    expect(buildLogParams(link.filters, false).has('username')).toBe(false)
    search.append('type', '2')
    expect(readLogLink(search.toString()).filters.type).toBe('0')
  })
  it('keeps native text syntax and request IDs while omitting privileged self filters', () => {
    const params = buildLogParams(filters, false)
    expect(params.get('model_name')).toBe('model')
    expect(params.get('request_id')).toBe('request/a?b')
    expect(params.has('username')).toBe(false)
    expect(params.has('channel')).toBe(false)
  })
  it('sends native admin filters but excludes record-only filters from stats', () => {
    const params = buildLogParams(filters, true, true)
    expect(params.get('username')).toBe('other-user')
    expect(params.get('channel')).toBe('12')
    for (const field of ['type', 'request_id', 'upstream_request_id', 'p', 'page_size']) expect(params.has(field)).toBe(false)
  })
  it.each([{ start: 'invalid' }, { end: '2026-10-19T00:00' }])('rejects an invalid or reversed date range %j', (patch) =>
    expect(() => buildLogParams({ ...filters, ...patch }, false)).toThrow('Invalid time range')
  )
  it('accepts absent or malformed extra data without fabricating an affinity target', () => {
    for (const other of ['bad', '[]', 'null', '{"admin_info":{"channel_affinity":{"rule_name":"rule"}}}']) {
      expect(logAffinity({ ...log, other })).toBeNull()
    }
    expect(logOther({ ...log, other: '[]' })).toEqual({})
  })
  it('uses native affinity group fallback and preserves opaque fingerprints', () => {
    const target = logAffinity({
      ...log,
      other: JSON.stringify({
        admin_info: { channel_affinity: { rule_name: 'rule', key_fp: 'a/b?c', selected_group: 'auto', key_hint: 'summary' } },
      }),
    })
    expect(target).toEqual({ rule_name: 'rule', key_fp: 'a/b?c', using_group: 'auto', key_hint: 'summary' })
  })
  it.each([false, true])('aligns CSV headers and data columns for admin=%s', (admin) => {
    const row = getLogCsvRow(log, admin, (s) => s, String, String)
    expect(row).toHaveLength(getLogCsvHeader(admin, (s) => s).length)
    expect(row.includes('user')).toBe(admin)
    expect(row.includes('#12 native')).toBe(admin)
    expect(row).toContain('5')
    expect(row).toContain('0s')
  })
  it('does not represent top-up and management logs as token consumption', () => {
    const row = getLogCsvRow({ ...log, type: 1 }, false, (s) => s, String, String),
      headers = getLogCsvHeader(false, (s) => s)
    for (const label of ['Input Tokens', 'Output Tokens', 'Cost', 'Duration', 'Stream']) expect(row[headers.indexOf(label)]).toBe('')
  })
  it('neutralizes spreadsheet formulas while preserving numeric negative values and quotes', () => {
    expect(toCsvLine(['=SUM(A1)', '+cmd', '-cmd', '@cmd', '-12.5', 'a"b', 'line\nbreak'])).toBe(
      '"\'=SUM(A1)","\'+cmd","\'-cmd","\'@cmd","-12.5","a""b","line\nbreak"\r\n'
    )
  })
})

function response(chunks: string[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    })
  )
}
describe('complete native NDJSON export', () => {
  it('reads chunk boundaries, blank lines and a terminal result without a final newline', async () => {
    const rows: UsageLog[] = []
    const text = JSON.stringify(log) + '\n\n' + JSON.stringify({ success: true, data: { count: 1 } })
    expect(await readLogExport(response([text.slice(0, 17), text.slice(17, 70), text.slice(70)]), (row) => rows.push(row))).toBe(1)
    expect(rows).toEqual([log])
  })
  it.each(['', '{"success":false,"message":"export denied"}'])(
    'rejects missing or unsuccessful completion instead of downloading a partial CSV: %s',
    async (terminal) => {
      await expect(readLogExport(response([JSON.stringify(log) + '\n' + terminal]), () => {})).rejects.toThrow()
    }
  )
  it('rejects an HTTP failure before reading log rows', async () => {
    await expect(readLogExport(new Response('{"message":"Denied"}', { status: 403 }), () => {})).rejects.toThrow('Denied')
  })
  it('propagates interrupted streams', async () => {
    const stream = new ReadableStream({
      pull(controller) {
        controller.error(new Error('connection lost'))
      },
    })
    await expect(readLogExport(new Response(stream), () => {})).rejects.toThrow('connection lost')
  })
  it('uses the native self endpoint and cancellable same-origin transport', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(['{"success":true,"data":{"count":0}}']))
    const signal = new AbortController().signal
    await exportLogs(new URLSearchParams({ type: '2' }), false, { signal, onLog: () => {} })
    expect(fetcher).toHaveBeenCalledWith(
      '/api/log/self/export?type=2',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store', signal })
    )
    fetcher.mockRestore()
  })
})
