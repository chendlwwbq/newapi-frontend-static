// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { ChannelsPage } from '../channels-page'
import { ModelsPage } from '../models-page'

const request = vi.hoisted(() => vi.fn())
const user = vi.hoisted(() => ({ id: 1, role: 100, group: 'default' }))
vi.mock('@/lib/auth/session', () => ({
  useAuth: () => ({ phase: 'ready', bundle: { user, session: { sid: 'test-session' } } }),
  freshAuthHeaders: async () => ({}),
}))
vi.mock('@/lib/api/client', () => ({ api: request, apiResponse: request }))

afterEach(() => {
  cleanup()
  request.mockReset()
})

it.each([
  { kind: 'channels', label: 'Status', option: 'Disabled', key: 'status', value: 'disabled', prefix: '/api/channel/' },
  { kind: 'models', label: 'Visibility', option: 'Hidden', key: 'square_state', value: 'hidden', prefix: '/api/models/' },
])(
  '$kind applies the selected filter only on Search, preserves the keyword and resets pagination',
  async ({ kind, label, option, key, value, prefix }) => {
    request.mockImplementation(async (url: string) => {
      if (url === '/api/user/self') return user
      if (url === '/api/status') return { quota_per_unit: 500000 }
      return { items: [], total: 60 }
    })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>{kind === 'channels' ? <ChannelsPage /> : <ModelsPage />}</QueryClientProvider>
      </I18nextProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
    await waitFor(() => expect(String(request.mock.calls.findLast(([url]) => String(url).startsWith(prefix))?.[0])).toContain('p=2'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'example' } })
    fireEvent.click(screen.getByRole('combobox', { name: label }))
    fireEvent.click(await screen.findByRole('option', { name: option }))
    const pending = String(request.mock.calls.findLast(([url]) => String(url).startsWith(prefix))?.[0])
    expect(new URLSearchParams(pending.split('?')[1]).get(key)).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      const url = String(request.mock.calls.findLast(([url]) => String(url).startsWith(prefix))?.[0])
      expect(Object.fromEntries(new URLSearchParams(url.split('?')[1]))).toMatchObject({ p: '1', keyword: 'example', [key]: value })
    })
    fireEvent.click(screen.getByRole('combobox', { name: label }))
    fireEvent.click(await screen.findByRole('option', { name: 'All' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      const url = String(request.mock.calls.findLast(([url]) => String(url).startsWith(prefix))?.[0])
      expect(Object.fromEntries(new URLSearchParams(url.split('?')[1]))).toMatchObject({ keyword: 'example', [key]: '' })
    })
  }
)
