// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { api } from '@/lib/api/client'
import { UsersPage } from '../users-page'

vi.mock('@/lib/api/client', () => ({ api: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, role: 100 } } }) }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('adds ¥100 in CNY mode using the corresponding wallet quota', async () => {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === '/api/status') return { quota_per_unit: 500000, quota_display_type: 'CNY', usd_exchange_rate: 7.3 }
    if (path === '/api/user/manage') return {}
    return { items: [{ id: 60, username: 'customer', role: 1, status: 1, quota: 0, used_quota: 0 }], total: 1 }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <UsersPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Adjust quota customer' }))
  const input = await screen.findByRole('spinbutton')
  fireEvent.change(input, { target: { value: '100' } })
  fireEvent.submit(input.closest('form')!)
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/api/user/manage', {
      method: 'POST',
      body: { id: 60, action: 'add_quota', mode: 'add', value: 6849315 },
    })
  )
})
