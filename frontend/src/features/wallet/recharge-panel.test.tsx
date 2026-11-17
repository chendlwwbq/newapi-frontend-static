// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render as renderUI, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, expect, it, vi } from 'vitest'
import { RechargePanel } from './recharge-panel'
import type { TopupInfo } from './types'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1 } } }) }))
afterEach(cleanup)

it('explains unavailable payments and displays Creem products only after confirmation', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient()
  const info = {
    payment_compliance_confirmed: false,
    enable_creem_topup: true,
    creem_products: [{ productId: 'one', name: 'Credits', price: 5, quota: 5, currency: 'USD' }],
    pay_methods: [],
    amount_options: [],
    discount: {},
    min_topup: 1,
    enable_online_topup: false,
    enable_stripe_topup: false,
    stripe_min_topup: 1,
  } as TopupInfo
  const render = (value: TopupInfo) =>
    renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <RechargePanel info={value} affiliate={<aside>Invite area</aside>} />
        </QueryClientProvider>
      </I18nextProvider>
    )

  const locked = render(info)
  expect(locked).toContain('administrator must confirm compliance terms')
  expect(locked).toContain('Invite area')
  expect(locked).not.toContain('Credits')
  expect(render({ ...info, payment_compliance_confirmed: true })).toContain('Credits')
  expect(render({ ...info, payment_compliance_confirmed: true, creem_products: [] })).toContain('No payment provider is configured.')
})

it('shows Creem quota in the same unit as the account balance at confirmation', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['status'], { quota_per_unit: 500000, quota_display_type: 'CNY', usd_exchange_rate: 7 })
  const info = {
    payment_compliance_confirmed: true,
    enable_creem_topup: true,
    creem_products: [{ productId: 'one', name: 'Credits', price: 5, quota: 500000, currency: 'EUR' }],
    pay_methods: [],
    amount_options: [],
    discount: {},
    min_topup: 1,
    enable_online_topup: false,
    enable_stripe_topup: false,
    stripe_min_topup: 1,
  } as TopupInfo
  renderUI(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RechargePanel info={info} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: /Credits/ }))
  await waitFor(() => expect(screen.getByText('Topup Amount').nextElementSibling?.textContent).toBe('¥7'))
  expect(screen.getByText('You Pay').nextElementSibling?.textContent).toBe('€5.00 EUR')
})

it('formats raw token top-up amounts and minimums without multiplying by quota_per_unit in TOKENS mode', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['status'], { quota_per_unit: 500000, quota_display_type: 'TOKENS' })
  const info = {
    payment_compliance_confirmed: true,
    enable_creem_topup: false,
    pay_methods: [{ name: 'Alipay', type: 'alipay', min_topup: 500000 }],
    amount_options: [],
    discount: {},
    min_topup: 500000,
    enable_online_topup: true,
    enable_stripe_topup: false,
    stripe_min_topup: 1,
  } as TopupInfo
  renderUI(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RechargePanel info={info} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(screen.getByText(/Minimum:/).textContent).toBe('Minimum: 500000 (500000 Tokens)')
  expect(screen.getByText(/Minimum:/).textContent).not.toContain('250,000,000,000')
  fireEvent.click(screen.getByRole('button', { name: 'Review payment' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Topup Amount').nextElementSibling?.textContent).toBe('500000')
})

it('trims surrounding whitespace on redemption code input', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const info = {
    payment_compliance_confirmed: true,
    enable_creem_topup: false,
    enable_redemption: true,
    pay_methods: [],
    amount_options: [],
    discount: {},
    min_topup: 1,
    enable_online_topup: false,
    enable_stripe_topup: false,
    stripe_min_topup: 1,
  } as TopupInfo
  renderUI(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RechargePanel info={info} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const codeInput = screen.getByLabelText('Redemption code') as HTMLInputElement
  fireEvent.change(codeInput, { target: { value: '  REDEEM-123  ' } })
  expect(codeInput.value).toBe('REDEEM-123')
})
