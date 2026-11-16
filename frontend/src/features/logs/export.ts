import { freshAuthHeaders } from '@/lib/auth/session'
import type { UsageLog } from '@/lib/api/types'
import { logTypeLabels } from './contracts'

export function toCsvLine(cells: string[]): string {
  return (
    cells
      .map((cell) => {
        let value = cell ?? ''
        if (/^[\t\r\n ]*[=+@-]/.test(value) && !/^-\d+(?:\.\d+)?$/.test(value)) value = `'${value}`
        return `"${value.replace(/"/g, '""')}"`
      })
      .join(',') + '\r\n'
  )
}

export function downloadCsv(filename: string, lines: string[]): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([`\ufeff${lines.join('')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

type Translate = (text: string) => string
const columns = ['Time', 'Type', 'Model', 'Token', 'Group', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost', 'Duration', 'Stream', 'Content']

export function getLogCsvHeader(admin: boolean, translate: Translate): string[] {
  return [...(admin ? ['User', 'Channel'] : []), ...columns].map(translate)
}

export function getLogCsvRow(
  log: UsageLog,
  admin: boolean,
  translate: Translate,
  quota: (value: number) => string,
  date: (value: number) => string
): string[] {
  const consume = log.type === 2
  const input = log.prompt_tokens || 0
  const output = log.completion_tokens || 0
  const channel = log.channel ? `#${log.channel}${log.channel_name ? ` ${log.channel_name}` : ''}` : ''
  return [
    ...(admin ? [log.username || '', channel] : []),
    date(log.created_at),
    translate(logTypeLabels[log.type] || 'Unknown'),
    log.model_name || '',
    log.token_name || '',
    log.group || '',
    consume ? String(input) : '',
    consume ? String(output) : '',
    consume ? String(input + output) : '',
    consume ? quota(log.quota) : '',
    consume ? `${log.use_time || 0}s` : '',
    consume ? translate(log.is_stream ? 'Yes' : 'No') : '',
    log.content || '',
  ]
}

export async function readLogExport(response: Response, onLog: (log: UsageLog) => void): Promise<number> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message || response.statusText || 'Failed to export logs')
  }
  if (!response.body) throw new Error('Incomplete log export')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let count = 0
  let completed = false
  const consume = (line: string) => {
    if (!line.trim()) return
    if (completed) throw new Error('Unexpected data after export completion')
    const item: unknown = JSON.parse(line)
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid log export')
    const record = item as Record<string, unknown>
    if ('success' in record) {
      const data = record.data as { count?: unknown } | undefined
      if (record.success !== true || typeof data?.count !== 'number' || data.count !== count)
        throw new Error((typeof record.message === 'string' && record.message) || 'Incomplete log export')
      completed = true
      return
    }
    if (typeof record.id !== 'number') throw new Error('Invalid log export')
    onLog(record as unknown as UsageLog)
    count++
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        consume(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
      }
      if (done) break
    }
    consume(buffer)
    if (!completed) throw new Error('Incomplete log export')
    return count
  } finally {
    reader.releaseLock()
  }
}

export async function exportLogs(
  params: URLSearchParams,
  admin: boolean,
  options: { signal?: AbortSignal; onLog: (log: UsageLog) => void }
): Promise<number> {
  const query = params.toString()
  const response = await fetch(`/api/log${admin ? '' : '/self'}/export${query ? `?${query}` : ''}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
    headers: await freshAuthHeaders(),
  })
  return readLogExport(response, options.onLog)
}
