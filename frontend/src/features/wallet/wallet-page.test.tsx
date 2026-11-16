// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import { WalletPage } from './wallet-page'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ api: request }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1 } } }) }))
vi.mock('@/lib/format', () => ({ useQuotaFormatter: () => String, formatNumber: (value: number) => String(value) }))
vi.mock('./recharge-panel', () => ({ RechargePanel: ({ affiliate }: { affiliate?: ReactNode }) => <div>Recharge content{affiliate}</div> }))
vi.mock('./subscription-panel', () => ({ SubscriptionPanel: () => null }))
vi.mock('./affiliate-panel', () => ({ AffiliatePanel: () => <div>Invitation content</div> }))
vi.mock('./order-history', () => ({ OrderHistory: () => <div>Order history content</div> }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('shows an account error instead of endless loading and recovers on retry', async () => {
  let failures = 1
  request.mockImplementation(async (url: string) => {
    if (url === '/api/user/self') {
      if (failures-- > 0) throw new Error('Account unavailable')
      return { quota: 10, used_quota: 0, aff_quota: 0 }
    }
    return { pay_methods: [], amount_options: [], discount: {} }
  })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <WalletPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByText('Account unavailable')
  expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.getByText('Recharge content')).toBeTruthy())
})

it('retries failed payment configuration and refreshes it from the wallet toolbar', async () => {
  let infoCalls = 0
  request.mockImplementation(async (url: string) => {
    if (url === '/api/user/self') return { quota: 10, used_quota: 0, aff_quota: 0 }
    infoCalls++
    if (infoCalls === 1) throw new Error('Configuration unavailable')
    return { pay_methods: [], amount_options: [], discount: {} }
  })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <WalletPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByText('Configuration unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('Recharge content')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await waitFor(() => expect(infoCalls).toBe(3))
})

it('shows account totals and opens order history from the balance card', async () => {
  request.mockImplementation(async (url: string) =>
    url === '/api/user/self' ? { quota: 10, used_quota: 2, aff_quota: 1, request_count: 42 } : { pay_methods: [], amount_options: [], discount: {} }
  )
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <WalletPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByText('42')
  expect(screen.getByText('Invitation content')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Orders' }))
  expect(await screen.findByText('Order history content')).toBeTruthy()
})
