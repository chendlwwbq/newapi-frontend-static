// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { OrderHistory } from './order-history'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, role: 1 } } }) }))
vi.mock('@/lib/api/client', () => ({
  api: async (url: string) =>
    url === '/api/status'
      ? { quota_per_unit: 500000, quota_display_type: 'CNY', usd_exchange_rate: 7 }
      : {
          total: 2,
          items: [
            { id: 1, trade_no: 'creem-order', amount: 500000, money: 5, payment_provider: 'creem', payment_method: 'creem', status: 'success' },
            { id: 2, trade_no: 'epay-order', amount: 2, money: 50, payment_provider: 'epay', payment_method: 'alipay', status: 'success' },
          ],
        },
}))
afterEach(cleanup)

it('formats Creem raw quota and other providers USD amounts using their respective units', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <OrderHistory />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const creem = (await screen.findByText('creem-order')).closest('tr')!
  const epay = screen.getByText('epay-order').closest('tr')!
  expect(within(creem).getAllByRole('cell')[2].textContent).toBe('¥7')
  expect(within(epay).getAllByRole('cell')[2].textContent).toBe('¥14')
  expect(within(epay).getAllByRole('cell')[3].textContent).toBe('50')
  expect(within(creem).getAllByRole('cell')[3].textContent).toBe('5')
})
