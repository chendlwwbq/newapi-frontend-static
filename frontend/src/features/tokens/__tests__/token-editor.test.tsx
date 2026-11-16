// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { Dialog } from '@/components/ui/dialog'
import { api } from '@/lib/api/client'
import type { Token } from '@/lib/api/types'
import { TokenEditor } from '../token-editor'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 66, group: 'special' }, session: { sid: 'test' } } }) }))
vi.mock('@/lib/api/client', () => ({ api: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('saves an unlimited key with a negative stored quota when its group changes', async () => {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === '/api/user/self/groups') return { official: { desc: 'Official', ratio: 1 }, special: { desc: 'Special', ratio: 0.85 } }
    if (path === '/api/token/auto-groups') return { groups: [], max_count: 3 }
    if (path === '/api/user/models') return []
    return {}
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const token = {
    id: 174,
    name: '2',
    group: 'official',
    status: 1,
    unlimited_quota: true,
    remain_quota: -2488932,
    expired_time: -1,
    model_limits_enabled: false,
    allow_ips: '',
  } as Token
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <Dialog open>
          <TokenEditor initial={token} status={{ quota_per_unit: 500000 }} onClose={() => {}} />
        </Dialog>
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByRole('option', { name: 'special · Special' })
  fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'special' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(vi.mocked(api)).toHaveBeenCalledWith(
      '/api/token/',
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({ id: 174, group: 'special', unlimited_quota: true, remain_quota: -2488932 }),
      })
    )
  )
})
