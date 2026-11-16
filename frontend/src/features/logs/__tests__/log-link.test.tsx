// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { LogsPage } from '../logs-page'

const request = vi.hoisted(() => vi.fn())
const auth = vi.hoisted(() => ({ role: 10 }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, role: auth.role } } }), freshAuthHeaders: async () => ({}) }))
vi.mock('@/lib/format', () => ({ useQuotaFormatter: () => String, formatNumber: String }))
vi.mock('@/lib/api/client', () => ({ api: request }))
afterEach(() => {
  cleanup()
  request.mockReset()
  auth.role = 10
  vi.restoreAllMocks()
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

function mockLogsApi(
  options: {
    items?: unknown[]
    total?: number
    stats?: () => { quota: number; rpm: number; tpm: number }
    status?: Record<string, unknown>
  } = {}
) {
  const items = options.items ?? []
  const stats = options.stats ?? (() => ({ quota: 0, rpm: 0, tpm: 0 }))
  request.mockImplementation(async (url: string) => {
    if (url === '/api/status') {
      return { log_export_enabled: true, log_max_range_days: 30, ...options.status }
    }
    if (url.startsWith('/api/log/self/stat?') || url.startsWith('/api/log/stat?')) {
      return stats()
    }
    if (url.startsWith('/api/log/self?') || url.startsWith('/api/log?')) {
      return { items, total: options.total ?? items.length }
    }
    throw new Error(`Unexpected API request: ${url}`)
  })
}

async function renderLogs(initialQuery = '') {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <LogsPage initialQuery={initialQuery} />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

it('loads a bookmarked admin search with its page size before fetching records', async () => {
  mockLogsApi({ total: 60 })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <LogsPage initialQuery="model=fixture&username=alice&type=2&page=2&pageSize=50" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect(request.mock.calls.some(([url]) => String(url).startsWith('/api/log?'))).toBe(true))
  const calls = request.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/log?') || url.startsWith('/api/log/self?'))
  expect(calls).toHaveLength(1)
  const params = new URLSearchParams(calls[0].split('?')[1])
  expect(Object.fromEntries(params)).toMatchObject({ model_name: 'fixture', username: 'alice', type: '2', p: '2', page_size: '50' })
  expect(request.mock.calls.some(([url]) => String(url).startsWith('/api/log/stat?'))).toBe(true)
  expect(screen.getByRole('combobox', { name: 'Scope' }).textContent).toBe('All records')
  expect(screen.getByLabelText('Username').closest('details')?.open).toBe(true)
  expect(await screen.findByText('RPM')).toBeTruthy()
  expect(screen.getByText('TPM')).toBeTruthy()
  fireEvent.click(screen.getByText('Collapse (1)'))
  await waitFor(() => expect(screen.getByText('Expand (1)')).toBeTruthy())
  expect(await screen.findByRole('heading', { name: 'No logs in this period' })).toBeTruthy()
})

it('keeps advanced filters collapsed until requested', async () => {
  mockLogsApi()
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <LogsPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByRole('button', { name: 'Search' })
  const expand = screen.getByText('Expand')
  expect(expand.closest('details')?.open).toBe(false)
  fireEvent.click(expand)
  await waitFor(() => expect(screen.getByLabelText('Request ID').closest('details')?.open).toBe(true))
})

it('hides stale statistics when refreshing statistics fails', async () => {
  let failStats = false
  mockLogsApi({
    stats: () => {
      if (failStats) throw new Error('Stats unavailable')
      return { quota: 100, rpm: 8, tpm: 42 }
    },
  })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <LogsPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(await screen.findByText('RPM')).toBeTruthy()
  failStats = true
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('Stats unavailable')).toBeTruthy()
  expect(screen.queryByText('RPM')).toBeNull()
})

it('writes applied filters to the address and restores them on history navigation', async () => {
  mockLogsApi({ total: 60 })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.replaceState(null, '', '/usage-logs/common?model=first')
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <LogsPage initialQuery="model=first" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect((screen.getByLabelText('Model') as HTMLInputElement).value).toBe('first'))
  fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'second' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  const written = new URLSearchParams(window.location.search)
  expect(written.get('model')).toBe('second')
  expect(written.has('modelName')).toBe(false)
  window.history.replaceState(null, '', '/usage-logs/common?model=first&page=2&pageSize=50&scope=self')
  fireEvent(window, new PopStateEvent('popstate'))
  await waitFor(() => expect((screen.getByLabelText('Model') as HTMLInputElement).value).toBe('first'))
  expect(screen.getByRole('combobox', { name: 'Scope' }).textContent).toBe('My records')
  expect(screen.getByRole('combobox', { name: 'Rows per page' }).textContent).toBe('50')
  await waitFor(() => {
    const call = request.mock.calls.map(([url]) => String(url)).findLast((url) => url.startsWith('/api/log/self?'))
    expect(call).toBeDefined()
    expect(Object.fromEntries(new URLSearchParams(call!.split('?')[1]))).toMatchObject({ model_name: 'first', p: '2', page_size: '50' })
    const statsCall = request.mock.calls.map(([url]) => String(url)).findLast((url) => url.startsWith('/api/log/self/stat?'))
    expect(statsCall).toBeDefined()
    const statsParams = new URLSearchParams(statsCall!.split('?')[1])
    expect(statsParams.get('model_name')).toBe('first')
    expect(statsParams.has('p')).toBe(false)
    expect(statsParams.has('page_size')).toBe(false)
  })
})

it('hides export for ordinary users when the administrator disables it', async () => {
  auth.role = 1
  mockLogsApi({ status: { log_export_enabled: false } })
  await renderLogs('scope=self')
  await screen.findByRole('heading', { name: 'No logs in this period' })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Export' })).toBeNull())
})

it('applies a draft type only on search and preserves it when changing the page size', async () => {
  mockLogsApi({ total: 60 })
  await renderLogs('scope=self&page=2&pageSize=20')
  await screen.findByRole('heading', { name: 'No logs in this period' })
  const before = request.mock.calls.length
  fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Consume' }))
  expect(screen.getByRole('combobox', { name: 'Type' }).textContent).toBe('Consume')
  expect(request.mock.calls.length).toBe(before)
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(request.mock.calls.some(([url]) => String(url).includes('type=2'))).toBe(true))
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Rows per page' }))
  fireEvent.click(await screen.findByRole('option', { name: '50' }))
  await waitFor(() => {
    const url = request.mock.calls.map(([url]) => String(url)).findLast((url) => url.startsWith('/api/log/self?'))!
    expect(Object.fromEntries(new URLSearchParams(url.split('?')[1]))).toMatchObject({ type: '2', p: '1', page_size: '50' })
  })
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Type' }).textContent).toBe('All'))
})

it('clears admin-only filters when switching back to personal records', async () => {
  mockLogsApi({ total: 60 })
  await renderLogs('scope=all&username=alice&channel=7&page=2')
  await screen.findByRole('heading', { name: 'No logs in this period' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Scope' }))
  fireEvent.click(await screen.findByRole('option', { name: 'My records' }))
  await waitFor(() => {
    const url = request.mock.calls.map(([url]) => String(url)).findLast((url) => url.startsWith('/api/log/self?'))
    expect(url).toBeDefined()
    const params = new URLSearchParams(url!.split('?')[1])
    expect(params.get('p')).toBe('1')
    expect(params.get('username') || '').toBe('')
    expect(params.get('channel') || '').toBe('')
  })
})

it('keeps admin export available and enforces the configured range', async () => {
  mockLogsApi({ status: { log_export_enabled: false, log_export_max_range: 7 } })
  await renderLogs('scope=self&start=2026-01-01T00:00:00&end=2026-01-11T00:00:00')
  fireEvent.click(await screen.findByRole('button', { name: 'Export' }))
  const dialog = await screen.findByRole('dialog')
  expect((await within(dialog).findByRole('alert')).textContent).toContain('The time range cannot exceed 7 days')
  expect(within(dialog).getByRole('button', { name: 'Download CSV' })).toHaveProperty('disabled', true)
})

it('opens the export dialog and streams every applied filter instead of the current page', async () => {
  mockLogsApi()
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"success":true,"data":{"count":0}}'))
  const createObjectURL = vi.fn(() => 'blob:logs')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await renderLogs('scope=self&model=gpt-4o&requestId=req-export&upstreamRequestId=up-export&group=vip&page=2&pageSize=50')
  await screen.findByRole('heading', { name: 'No logs in this period' })
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Export every matching record in the applied filters, beyond the current page.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Download CSV' }))
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce())
  const url = String(fetchSpy.mock.calls[0][0])
  expect(url.startsWith('/api/log/self/export?')).toBe(true)
  const params = new URLSearchParams(url.split('?')[1])
  expect(Object.fromEntries(params)).toMatchObject({
    model_name: 'gpt-4o',
    request_id: 'req-export',
    upstream_request_id: 'up-export',
    group: 'vip',
  })
  expect(params.has('p')).toBe(false)
  expect(params.has('page_size')).toBe(false)
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
})
