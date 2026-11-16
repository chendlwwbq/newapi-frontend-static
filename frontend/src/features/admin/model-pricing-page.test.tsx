// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { api } from '@/lib/api/client'
import { ModelPricingPage } from './model-pricing-page'

vi.mock('@/lib/api/client', () => ({ api: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, role: 100 }, session: { sid: 'test' } } }) }))
vi.mock('./metadata-nav', () => ({ MetadataNav: () => null }))
vi.mock('./pricing/expression-editor', () => ({
  BillingExpressionEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Expression editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('@/features/catalog/price-breakdown', () => ({
  PriceBreakdown: ({ quote }: { quote: { billing_expr: string } }) => <p>Displayed: {quote.billing_expr}</p>,
}))
vi.mock('./shared', () => ({
  AdminSearch: () => null,
  AdminPagination: () => null,
  AdminConfirm: ({ description }: { description: string }) => <p>{description}</p>,
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('displays route labels, saves one group without changing another group or plugin prices, and warns before reset', async () => {
  const original = {
    'billing_setting.billing_mode': 'tiered_expr',
    'billing_setting.billing_expr': 'tier("base", p * 1)',
    'billing_setting.group_billing_expr': { 'xlsx-g-one': 'tier("base", p * 2)', 'xlsx-g-two': 'tier("base", p * 3)' },
    'billing_setting.plugin_billing_expr': { seedance: 'tier("base", u("seconds") * 4)' },
  }
  const snapshot = { empty_version: 'empty', entries: [{ model_name: 'seedance-fixture', version: 'v1', configured: original, effective: original }] }
  vi.mocked(api).mockImplementation(async (url, options) => {
    if (options?.method === 'PATCH') return {}
    if (url === '/api/user/self/groups') return { 'xlsx-g-one': { desc: 'Special route' } }
    if (url === '/api/channel/?p=1&page_size=100') return { items: [{ name: 'Other', models: 'other', group: 'other' }], total: 2 }
    if (url === '/api/channel/?p=2&page_size=100')
      return { items: [{ name: 'Stable route', models: 'seedance-fixture', group: 'xlsx-g-two' }], total: 2 }
    return snapshot
  })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModelPricingPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Edit seedance-fixture' }))
  expect(await screen.findByText('Special route')).toBeTruthy()
  expect(screen.getByText('Stable route')).toBeTruthy()
  expect(screen.getByText('Displayed: tier("base", p * 2)')).toBeTruthy()
  const field = screen.getByDisplayValue('tier("base", p * 2)')
  fireEvent.change(field, { target: { value: '' } })
  expect(screen.getByText('A route price cannot be blank.')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(field, { target: { value: 'tier("base", p * 8)' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(vi.mocked(api).mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(true))
  const request = vi.mocked(api).mock.calls.find(([, options]) => options?.method === 'PATCH')![1]!
  expect(request.body).toEqual({
    changes: [
      {
        model_name: 'seedance-fixture',
        expected_version: 'v1',
        pricing: { ...original, 'billing_setting.group_billing_expr': { 'xlsx-g-one': 'tier("base", p * 8)', 'xlsx-g-two': 'tier("base", p * 3)' } },
      },
    ],
  })
  fireEvent.click(await screen.findByRole('button', { name: 'Reset pricing overrides seedance-fixture' }))
  expect(screen.getByText(/This also removes all saved route prices/)).toBeTruthy()
  expect(screen.getByText(/This also removes all saved plugin prices/)).toBeTruthy()
})
