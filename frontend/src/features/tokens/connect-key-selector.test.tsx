// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { api } from '@/lib/api/client'
import { ConnectKeySelector } from './connect-key-selector'

vi.mock('@/lib/api/client', () => ({ api: vi.fn() }))
vi.mock('@/features/auth/secure-verification/security-dialog', () => ({
  SecurityDialog: ({
    operation,
    onAuthorized,
    onClose,
  }: {
    operation: { context: { token_ids: number[] } }
    onAuthorized: (proof: string, signal: AbortSignal) => Promise<void>
    onClose: () => void
  }) => (
    <button onClick={() => void onAuthorized('verified-proof', new AbortController().signal).then(onClose)}>
      Verify {operation.context.token_ids.join(',')}
    </button>
  ),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shows the key group and waits for scoped verification before reading the key', async () => {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === '/api/token/42/key') return { key: 'private-test-key' }
    return { items: [{ id: 42, name: 'my key', status: 1, group: 'vip', expired_time: -1, unlimited_quota: true }], total: 1 }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ConnectKeySelector userId={7} sessionId="session" group="vip" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Choose an API key' }))
  expect(await screen.findByText('my key')).toBeTruthy()
  expect(screen.getAllByText(/Group: vip/).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  expect(vi.mocked(api).mock.calls.some(([url]) => url === '/api/token/42/key')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Verify 42' }))
  await waitFor(() => expect(screen.getByText('sk-private-test-key')).toBeTruthy())
  expect(vi.mocked(api)).toHaveBeenCalledWith('/api/token/42/key', expect.objectContaining({ headers: { 'X-Security-Proof': 'verified-proof' } }))
  expect(JSON.stringify(client.getQueryData(['connect-keys', 7, 'session', 1, '']))).not.toContain('private-test-key')
})

it('only allows keys for the selected route, accounting for inherited and auto groups', async () => {
  vi.mocked(api).mockResolvedValue({
    items: [
      { id: 1, name: 'matched', status: 1, group: 'vip', expired_time: -1, unlimited_quota: true },
      { id: 2, name: 'wrong group', status: 1, group: 'default', expired_time: -1, unlimited_quota: true },
      { id: 3, name: 'inherited', status: 1, group: '', expired_time: -1, unlimited_quota: true },
      { id: 4, name: 'auto', status: 1, group: 'auto', expired_time: -1, unlimited_quota: true },
    ],
    total: 4,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ConnectKeySelector userId={7} sessionId="session" group="vip" userGroup="vip" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Choose an API key' }))
  const buttonFor = (name: string) =>
    within(screen.getByText(name).closest('.settings-collection-row') as HTMLElement).getByRole('button', { name: 'Select' }) as HTMLButtonElement
  await screen.findByText('matched')
  expect(buttonFor('matched').disabled).toBe(false)
  expect(buttonFor('inherited').disabled).toBe(false)
  expect(buttonFor('wrong group').disabled).toBe(true)
  expect(buttonFor('auto').disabled).toBe(true)
  fireEvent.click(buttonFor('wrong group'))
  expect(screen.queryByText('Verify 2')).toBeNull()
})

it('rejects an inherited key when the user group differs from the route', async () => {
  vi.mocked(api).mockResolvedValue({ items: [{ id: 3, name: 'inherited', status: 1, group: '', expired_time: -1, unlimited_quota: true }], total: 1 })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ConnectKeySelector userId={7} sessionId="session" group="vip" userGroup="default" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Choose an API key' }))
  await screen.findByText('inherited')
  expect((screen.getByRole('button', { name: 'Select' }) as HTMLButtonElement).disabled).toBe(true)
})

it('shows the authorized route label while matching keys by group ID', async () => {
  vi.mocked(api).mockResolvedValue({
    items: [{ id: 3, name: 'matched', status: 1, group: 'xlsx-g-123', expired_time: -1, unlimited_quota: true }],
    total: 1,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ConnectKeySelector userId={7} sessionId="session" group="xlsx-g-123" groupLabel="Supplier route" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(screen.getByText(/Group: Supplier route/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Choose an API key' }))
  await screen.findByText('matched')
  expect((screen.getByRole('button', { name: 'Select' }) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.queryByText(/Group: xlsx-g-123/)).toBeNull()
})

it('disables selection for disabled, expired, or exhausted keys even when the group matches', async () => {
  vi.mocked(api).mockResolvedValue({
    items: [
      { id: 10, name: 'disabled-key', status: 2, group: 'vip', expired_time: -1, unlimited_quota: true, remain_quota: 0 },
      { id: 11, name: 'expired-key', status: 1, group: 'vip', expired_time: 1000, unlimited_quota: true, remain_quota: 0 },
      { id: 12, name: 'exhausted-key', status: 1, group: 'vip', expired_time: -1, unlimited_quota: false, remain_quota: 0 },
    ],
    total: 3,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ConnectKeySelector userId={7} sessionId="session" group="vip" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Choose an API key' }))
  await screen.findByText('disabled-key')
  for (const name of ['disabled-key', 'expired-key', 'exhausted-key']) {
    const row = screen.getByText(name).closest('.settings-collection-row') as HTMLElement
    expect((within(row).getByRole('button', { name: 'Select' }) as HTMLButtonElement).disabled).toBe(true)
  }
})
