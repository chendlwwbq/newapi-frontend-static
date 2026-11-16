// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { TasksPage } from '../tasks-page'
import { DrawingLogsPage } from '../drawing-logs-page'

const request = vi.hoisted(() => vi.fn())
const auth = vi.hoisted(() => ({ role: 10 }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, role: auth.role } } }) }))
vi.mock('@/lib/format', () => ({ useQuotaFormatter: () => String, formatNumber: String }))
vi.mock('@/lib/api/client', () => ({ api: request }))
afterEach(() => {
  cleanup()
  request.mockReset()
  auth.role = 10
  window.history.replaceState(null, '', '/')
})

async function renderTaskLogs(kind: string, query = '') {
  request.mockResolvedValue({ items: [], total: 60 })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.replaceState(null, '', `/usage-logs/${kind}?${query}`)
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        {kind === 'task' ? <TasksPage initialQuery={query} /> : <DrawingLogsPage initialQuery={query} />}
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByRole('combobox', { name: 'Rows per page' })
}

it.each(['task', 'drawing'])('changing %s page size preserves filters and resets the page', async (kind) => {
  await renderTaskLogs(kind, 'filter=kept-id&channel=8&page=2&pageSize=20&scope=all')
  fireEvent.click(screen.getByRole('combobox', { name: 'Rows per page' }))
  fireEvent.click(await screen.findByRole('option', { name: '50' }))
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toMatchObject({
    filter: 'kept-id',
    channel: '8',
    page: '1',
    pageSize: '50',
    scope: 'all',
  })
  await waitFor(() => {
    const params = new URLSearchParams(String(request.mock.lastCall?.[0]).split('?')[1])
    expect(params.get('page_size')).toBe('50')
    expect(params.get(kind === 'task' ? 'task_id' : 'mj_id')).toBe('kept-id')
  })
})

it.each(['task', 'drawing'])('changing %s scope to self clears the channel and resets the page', async (kind) => {
  await renderTaskLogs(kind, 'filter=kept-id&channel=8&page=2&scope=all')
  fireEvent.click(screen.getByRole('combobox', { name: 'Scope' }))
  fireEvent.click(await screen.findByRole('option', { name: 'My records' }))
  const params = new URLSearchParams(window.location.search)
  expect(params.get('scope')).toBe('self')
  expect(params.get('page')).toBe('1')
  expect(params.get('filter')).toBe('kept-id')
  expect(params.has('channel')).toBe(false)
  expect(screen.queryByLabelText('Channel ID')).toBeNull()
  await waitFor(() => expect(String(request.mock.lastCall?.[0])).toContain(kind === 'task' ? '/api/task/self?' : '/api/mj/self?'))
})

it('selecting a task status waits for Search and Reset restores all statuses', async () => {
  await renderTaskLogs('task', 'page=2&filter=kept-id')
  fireEvent.click(screen.getByRole('combobox', { name: 'Status' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Failed' }))
  expect(new URLSearchParams(window.location.search).has('status')).toBe(false)
  expect(String(request.mock.lastCall?.[0])).not.toContain('status=FAILURE')
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toMatchObject({ status: 'FAILURE', page: '1', filter: 'kept-id' })
  await waitFor(() => expect(String(request.mock.lastCall?.[0])).toContain('status=FAILURE'))
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  expect(new URLSearchParams(window.location.search).has('status')).toBe(false)
  expect(screen.getByRole('combobox', { name: 'Status' }).textContent).toBe('All statuses')
})

it.each(['task', 'drawing'])('hides the %s scope selector from ordinary users', async (kind) => {
  auth.role = 1
  await renderTaskLogs(kind, 'scope=all')
  expect(screen.queryByRole('combobox', { name: 'Scope' })).toBeNull()
  expect(String(request.mock.lastCall?.[0])).toContain(kind === 'task' ? '/api/task/self?' : '/api/mj/self?')
})

it.each(['task', 'drawing'])('restores and updates %s log links', async (kind) => {
  request.mockResolvedValue({ items: [], total: 60 })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const query = 'filter=old-id&channel=8&page=2&pageSize=30&startTime=1793001600000&endTime=1793088000000'
  window.history.replaceState(null, '', `/usage-logs/${kind}?${query}`)
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        {kind === 'task' ? <TasksPage initialQuery={query} /> : <DrawingLogsPage initialQuery={query} />}
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect(request).toHaveBeenCalled())
  const url = String(request.mock.calls[0][0]),
    params = new URLSearchParams(url.split('?')[1])
  expect(params.get(kind === 'task' ? 'task_id' : 'mj_id')).toBe('old-id')
  expect(params.get('channel_id')).toBe('8')
  expect(params.get('page_size')).toBe('30')
  expect(Number(params.get('start_timestamp'))).toBe(kind === 'task' ? 1793001600 : 1793001600000)
  fireEvent.change(screen.getByLabelText('Task ID'), { target: { value: 'new-id' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(new URLSearchParams(window.location.search).get('filter')).toBe('new-id')
  window.history.replaceState(null, '', `/usage-logs/${kind}?${query}`)
  fireEvent(window, new PopStateEvent('popstate'))
  await waitFor(() => expect((screen.getByLabelText('Task ID') as HTMLInputElement).value).toBe('old-id'))
})
