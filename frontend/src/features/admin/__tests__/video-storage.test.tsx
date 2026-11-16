// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { api } from '@/lib/api/client'
import { VideoStoragePanel } from '../video-storage-panel'

vi.mock('@/lib/api/client', () => ({ api: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, role: 100 } } }) }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('pauses and resumes automatic storage with one click and displays the saved state', async () => {
  let enabled = true
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') {
      enabled = (options.body as { value: boolean }).value
      return {}
    }
    return { enabled, configured: true, bucket_host: 'private.cos.ap-singapore.myqcloud.com', sources: ['Omni', 'Fast'], signed_url_hours: 24 }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <VideoStoragePanel />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const toggle = await screen.findByRole('switch', { name: 'Automatic video storage' })
  expect(toggle.getAttribute('aria-checked')).toBe('true')
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'))
  expect(api).toHaveBeenCalledWith('/api/option', { method: 'PUT', body: { key: 'VideoStorageEnabled', value: false } })
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
  expect(api).toHaveBeenCalledWith('/api/option', { method: 'PUT', body: { key: 'VideoStorageEnabled', value: true } })
})

it('shows bucket usage and saves a channel policy independently of the global switch', async () => {
  let stored = true
  vi.mocked(api).mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') {
      stored = (options.body as { value: boolean }).value
      return {}
    }
    return {
      enabled: true,
      configured: true,
      bucket_host: 'private.cos.example',
      sources: [],
      signed_url_hours: 24,
      channels: [
        { id: 21, name: 'Fast', status: 1, storage_enabled: stored, direct_only: false },
        { id: 22, name: 'Already stored', status: 1, storage_enabled: true, direct_only: true },
      ],
      usage: { status: 'ready', used_bytes: 2 * 1024 ** 3, object_count: 1234, updated_at: 1794816000, refreshing: false },
    }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <VideoStoragePanel />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(await screen.findByText('2 GiB')).toBeTruthy()
  expect(screen.getByText('1,234')).toBeTruthy()
  const channel = screen.getByRole('switch', { name: 'Store videos for channel Fast' })
  fireEvent.click(channel)
  await waitFor(() => expect(channel.getAttribute('aria-checked')).toBe('false'))
  expect(api).toHaveBeenCalledWith('/api/option', { method: 'PUT', body: { key: 'VideoStorageChannelEnabled:21', value: false } })
  expect(screen.getByRole('switch', { name: 'Automatic video storage' }).getAttribute('aria-checked')).toBe('true')
  expect(screen.getByRole('switch', { name: 'Store videos for channel Already stored' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search channels' }), { target: { value: '21' } })
  expect(screen.queryByText('#22 · Already stored')).toBeNull()
  expect(screen.getByText('#21 · Fast')).toBeTruthy()
})
