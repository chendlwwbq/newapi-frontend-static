// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { api } from '@/lib/api/client'
import { ClientConnection } from './chat-clients'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 7 }, session: { sid: 'one' } } }) }))
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
    <button onClick={() => void onAuthorized('proof', new AbortController().signal).then(onClose)}>
      Verify {operation.context.token_ids.join(',')}
    </button>
  ),
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('prefills the chosen route model and only allows a key for that group', async () => {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === '/api/user/models') return ['other-model']
    if (path === '/api/token/42/key') return { key: 'test-secret' }
    return {
      items: [
        { id: 42, name: 'matching', group: 'vip', status: 1, expired_time: -1, unlimited_quota: true },
        { id: 43, name: 'other', group: 'other', status: 1, expired_time: -1, unlimited_quota: true },
      ],
      total: 2,
    }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ClientConnection
          preset={{ id: 'cc', name: 'CC Switch', url: 'ccswitch', type: 'custom-protocol' }}
          address="https://gateway.test"
          initialApp="codex"
          initialModel="selected/model"
          requiredGroup="vip"
          onClose={() => {}}
        />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const matching = await screen.findByRole('radio', { name: /matching/ })
  expect((screen.getByRole('radio', { name: /other/ }) as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByLabelText('Primary Model') as HTMLSelectElement).value).toBe('selected/model')
  fireEvent.click(matching)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Share the selected API key with this client' }))
  fireEvent.click(screen.getByRole('button', { name: 'Prepare connection' }))
  expect(vi.mocked(api).mock.calls.some(([url]) => url === '/api/token/42/key')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Verify 42' }))
  await screen.findByRole('button', { name: 'Open client' })
  expect(vi.mocked(api)).toHaveBeenCalledWith('/api/token/42/key', expect.objectContaining({ headers: { 'X-Security-Proof': 'proof' } }))
  expect(open).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Open client' }))
  await waitFor(() => expect(open).toHaveBeenCalledOnce())
  const target = new URL(String(open.mock.calls[0][0]))
  expect(target.protocol).toBe('ccswitch:')
  expect(target.searchParams.get('model')).toBe('selected/model')
  expect(target.searchParams.get('endpoint')).toBe('https://gateway.test/v1')
})
