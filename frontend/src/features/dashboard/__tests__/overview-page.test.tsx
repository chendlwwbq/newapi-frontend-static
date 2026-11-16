// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { OverviewPage } from '../overview-page'

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/auth/session', () => ({
  useAuth: () => ({ bundle: { user: { id: 1, role: 1, quota: 0, used_quota: 0, request_count: 0 } } }),
}))
vi.mock('../configured-panels', () => ({ ConfiguredPanels: () => null }))
vi.mock('../analytics-panel', () => ({ AnalyticsPanel: () => null }))
vi.mock('@/lib/format', () => ({ useQuotaFormatter: () => (value: number) => `$${value / 500000}` }))

function mockRequests({ statusError = false, keysError = false, keyTotal = 0 } = {}) {
  apiMock.mockImplementation((path: string) => {
    if (path === '/api/status') {
      return statusError
        ? Promise.reject(new Error('Status unavailable'))
        : Promise.resolve({ enable_data_export: true, server_address: 'https://gateway.test' })
    }
    if (path === '/api/user/self') return Promise.resolve({ id: 1, role: 1, quota: 0, used_quota: 0, request_count: 0 })
    if (path === '/api/catalog/models?currency=CNY') return Promise.resolve({ models: [] })
    if (path.startsWith('/api/token/')) {
      return keysError ? Promise.reject(new Error('Keys unavailable')) : Promise.resolve({ items: [], total: keyTotal })
    }
    if (path.startsWith('/api/data/self?')) return Promise.resolve([])
    return Promise.reject(new Error(`Unexpected request: ${path}`))
  })
}

beforeEach(() => {
  apiMock.mockReset()
  mockRequests()
})
afterEach(cleanup)

async function renderOverview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <OverviewPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

it('shows status failures without the normal data-delay note and recovers on retry', async () => {
  mockRequests({ statusError: true })
  await renderOverview()

  expect(await screen.findByText('Status unavailable')).toBeTruthy()
  expect(screen.queryByText('Latest 24 hourly buckets, including the current partial hour. Data may be delayed.')).toBeNull()
  mockRequests()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByText('Status unavailable')).toBeNull())
  expect(screen.getByText('Latest 24 hourly buckets, including the current partial hour. Data may be delayed.')).toBeTruthy()
})

it('marks the key setup step unavailable on failure and completes it after a successful retry', async () => {
  mockRequests({ keysError: true })
  await renderOverview()

  expect(await screen.findByText('Keys unavailable')).toBeTruthy()
  const step = screen.getByText('1. Create API key').closest('li')
  expect(step?.querySelector('[aria-label="Unavailable"]')).not.toBeNull()
  expect(step?.querySelector('[aria-label="Pending"]')).toBeNull()

  mockRequests({ keyTotal: 1 })
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(step?.querySelector('[aria-label="Completed"]')).not.toBeNull())
  expect(screen.queryByText('Keys unavailable')).toBeNull()
})
