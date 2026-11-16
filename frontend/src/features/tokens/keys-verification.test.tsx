// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { api } from '@/lib/api/client'
import { KeysPage } from './keys-page'
import Page from '@/app/(console)/keys/page'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 7 } } }) }))
vi.mock('@/lib/format', () => ({ useQuotaFormatter: () => String }))
vi.mock('@/lib/api/client', () => ({ api: vi.fn() }))
vi.mock('@/components/motion/mascot', () => ({ MascotMark: () => null }))
vi.mock('./token-editor', () => ({
  TokenEditor: ({ requestedGroup }: { requestedGroup?: string }) => (
    <DialogContent>
      <DialogTitle>New key</DialogTitle>
      <p>Selected group: {requestedGroup || 'default'}</p>
    </DialogContent>
  ),
}))
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

it('offers filter reset instead of first-key guidance when existing keys do not match the selected status', async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === '/api/status'
      ? { quota_per_unit: 500000 }
      : {
          items: [
            {
              id: 42,
              name: 'test key',
              status: 1,
              expired_time: -1,
              unlimited_quota: true,
              remain_quota: 0,
              used_quota: 0,
              group: 'default',
              created_time: 0,
              model_limits_enabled: false,
              model_limits: '',
              allow_ips: '',
            },
          ],
          total: 1,
        }
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <KeysPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByText('test key')
  fireEvent.change(screen.getByLabelText('Status (current page)'), { target: { value: 'Disabled' } })
  expect(screen.queryByText('Create your first API key to start building.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
  expect(screen.getByText('test key')).toBeTruthy()
})

it('opens creation with the requested group when navigating within the keys page', async () => {
  vi.mocked(api).mockImplementation(async (path) => (path === '/api/status' ? { quota_per_unit: 500000 } : { items: [], total: 0 }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const wrap = (element: React.ReactNode) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>{element}</QueryClientProvider>
    </I18nextProvider>
  )
  const { rerender } = render(wrap(await Page({ searchParams: Promise.resolve({}) })))
  expect(screen.queryByText('Selected group: vip')).toBeNull()
  rerender(wrap(await Page({ searchParams: Promise.resolve({ create: '1', group: 'vip' }) })))
  expect(await screen.findByText('Selected group: vip')).toBeTruthy()
})

it('requires action-bound verification before requesting a key and forwards its proof', async () => {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === '/api/status') return { quota_per_unit: 500000 }
    if (path === '/api/token/batch/keys') return { keys: { 42: 'secret' } }
    return {
      items: [
        {
          id: 42,
          name: 'test key',
          status: 1,
          expired_time: -1,
          unlimited_quota: true,
          remain_quota: 0,
          used_quota: 0,
          group: 'default',
          created_time: 0,
          model_limits_enabled: false,
          model_limits: '',
          allow_ips: '',
        },
      ],
      total: 1,
    }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <KeysPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(await screen.findByRole('button', { name: 'View keys test key' }))
  expect(vi.mocked(api).mock.calls.some(([url]) => url === '/api/token/batch/keys')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Verify 42' }))
  await waitFor(() => expect(screen.getByText('sk-secret')).toBeTruthy())
  expect(vi.mocked(api)).toHaveBeenCalledWith(
    '/api/token/batch/keys',
    expect.objectContaining({ headers: { 'X-Security-Proof': 'verified-proof' }, body: { ids: [42] } })
  )
})
