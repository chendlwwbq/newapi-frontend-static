// @vitest-environment happy-dom
import { type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { toast } from 'sonner'
import { ChannelsPage } from '../channels-page'
import { UsersPage } from '../users-page'
import { ChannelEditor } from '../channel-editor'
import { ChannelPriorityDialog } from '../channel-priority-dialog'
import { ModelPricingPage } from '../model-pricing-page'
import { RedemptionsPage } from '../redemptions-page'
import { newChannel } from '../lib/channel-form'
import type { Channel } from '../types'

const request = vi.hoisted(() => vi.fn())
const user = vi.hoisted(() => ({ id: 1, role: 100, group: 'default' }))
vi.mock('@/lib/auth/session', () => ({
  useAuth: () => ({ phase: 'ready', bundle: { user, session: { sid: 'test' } } }),
  freshAuthHeaders: async () => ({}),
}))
vi.mock('@/lib/api/client', () => ({ api: request, apiResponse: request }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  request.mockReset()
  window.history.replaceState(null, '', '/')
})

async function mount(children: ReactNode, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  return {
    client,
    ...render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </I18nextProvider>
    ),
  }
}

it('keeps the last clicked channel when details arrive out of order and resets its draft', async () => {
  const a = { ...newChannel, id: 1, name: 'Channel A', status: 1 }
  const b = { ...newChannel, id: 2, name: 'Channel B', status: 1 }
  let resolveA!: (value: unknown) => void
  let resolveB!: (value: unknown) => void
  const pendingA = new Promise((resolve) => {
    resolveA = resolve
  })
  const pendingB = new Promise((resolve) => {
    resolveB = resolve
  })
  request.mockImplementation(async (url: string) => {
    if (url === '/api/user/self') return user
    if (url === '/api/status') return { quota_per_unit: 500000, quota_display_type: 'TOKENS' }
    if (url === '/api/channel/1') return pendingA
    if (url === '/api/channel/2') return pendingB
    if (url.startsWith('/api/channel/?')) return { items: [a, b], total: 2 }
    return []
  })
  await mount(<ChannelsPage />)
  const editA = await screen.findByRole('button', { name: 'Edit Channel A' })
  const editB = screen.getByRole('button', { name: 'Edit Channel B' })
  fireEvent.click(editA)
  fireEvent.click(editB)
  await act(async () => {
    resolveB(b)
  })
  const name = await screen.findByRole('textbox', { name: 'Name' })
  expect(name).toHaveProperty('value', 'Channel B')
  fireEvent.change(name, { target: { value: 'Unsaved B draft' } })
  await act(async () => {
    resolveA(a)
  })
  expect(name).toHaveProperty('value', 'Unsaved B draft')
  // Switch a mounted editor: the new channel must get its own form state.
  fireEvent.click(editA)
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveProperty('value', 'Channel A'))
})

it('reports each invalid advanced JSON field next to that field and allows a corrected save', async () => {
  request.mockResolvedValue([])
  await mount(
    <ChannelEditor initial={{ ...newChannel, id: 1, name: 'Channel', models: 'model' }} sensitive pluginBind ownerId={1} onClose={vi.fn()} />
  )
  const keys = ['model_mapping', 'status_code_mapping', 'setting', 'settings', 'param_override', 'header_override']
  for (const [index, key] of keys.entries()) {
    fireEvent.change(document.getElementById(`channel-${key}`)!, { target: { value: ['{', '[]', 'null', '42', 'false', '"string"'][index] } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  for (const key of keys) {
    const field = document.getElementById(`channel-${key}`)!
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(field.getAttribute('aria-describedby')!)?.textContent).toBe('Invalid JSON object')
  }
  expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
  for (const key of keys) fireEvent.change(document.getElementById(`channel-${key}`)!, { target: { value: '{}' } })
  expect(screen.queryAllByRole('alert')).toHaveLength(0)
  expect(document.getElementById('channel-header_override')?.closest('details')?.open).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(request.mock.calls.some(([url, options]) => url === '/api/channel' && options?.body.id === 1)).toBe(true))
})

it('loads priority names from all pages and reuses the name cache when reopened', async () => {
  request.mockImplementation(async (url: string) => {
    if (url === '/api/channel/priority/order')
      return {
        revision: 'one',
        items: [
          { id: 1, priority: 2 },
          { id: 2, priority: 1 },
        ],
        changes: [],
      }
    return { total: 2, items: [url.includes('p=1&') ? { id: 1, name: 'First channel' } : { id: 2, name: 'Off-page channel' }] }
  })
  const props = { channels: [{ id: 1, name: 'First channel' }] as Channel[], ownerId: 1, write: true, onClose: vi.fn() }
  const first = await mount(<ChannelPriorityDialog {...props} />)
  expect(await screen.findAllByRole('option', { name: '#2 Off-page channel · 1' })).toHaveLength(2)
  expect(request.mock.calls.filter(([url]) => url.includes('page_size=100'))).toHaveLength(2)
  first.unmount()
  await mount(<ChannelPriorityDialog {...props} />, first.client)
  expect(screen.getAllByRole('option', { name: '#2 Off-page channel · 1' }).length).toBeGreaterThan(0)
  expect(request.mock.calls.filter(([url]) => url.includes('page_size=100'))).toHaveLength(2)
})

it('shows a reset failure inside the confirmation dialog and sends a toast', async () => {
  const toastError = vi.spyOn(toast, 'error')
  request.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (options?.method === 'PATCH') throw new Error('Reset rejected')
    if (url === '/api/option/model_pricing')
      return { empty_version: 'empty', entries: [{ model_name: 'fixture', version: 'v1', configured: { model_ratio: 2 }, effective: {} }] }
    if (url.startsWith('/api/channel/')) return { items: [], total: 0 }
    return {}
  })
  await mount(<ModelPricingPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Reset pricing overrides fixture' }))
  const dialog = screen.getByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
  expect((await within(dialog).findByRole('alert')).textContent).toBe('Reset rejected')
  expect(toastError).toHaveBeenCalledWith('Reset rejected')
})

it('keeps the last clicked user when user details arrive out of order and resets the editor draft', async () => {
  const alice = {
    id: 11,
    username: 'alice',
    display_name: 'Alice',
    role: 1,
    status: 1,
    group: 'default',
    quota: 0,
    used_quota: 0,
    request_count: 0,
    remark: '',
  }
  const bob = {
    id: 12,
    username: 'bob',
    display_name: 'Bob',
    role: 1,
    status: 1,
    group: 'default',
    quota: 0,
    used_quota: 0,
    request_count: 0,
    remark: '',
  }
  let resolveAlice!: (value: unknown) => void
  let resolveBob!: (value: unknown) => void
  const pendingAlice = new Promise((resolve) => {
    resolveAlice = resolve
  })
  const pendingBob = new Promise((resolve) => {
    resolveBob = resolve
  })
  request.mockImplementation(async (url: string) => {
    if (url === '/api/status') return { quota_per_unit: 500000, quota_display_type: 'TOKENS' }
    if (url === '/api/authz/catalog') return { resources: [], roles: [] }
    if (url === '/api/user/11') return pendingAlice
    if (url === '/api/user/12') return pendingBob
    if (url.startsWith('/api/user/search')) return { items: [alice, bob], total: 2 }
    return []
  })
  await mount(<UsersPage />)
  const editAlice = await screen.findByRole('button', { name: 'Edit alice' })
  const editBob = screen.getByRole('button', { name: 'Edit bob' })
  fireEvent.click(editAlice)
  fireEvent.click(editBob)
  await act(async () => {
    resolveBob(bob)
  })
  const username = await screen.findByRole('textbox', { name: 'Username' })
  expect(username).toHaveProperty('value', 'bob')
  fireEvent.change(username, { target: { value: 'bob-edited' } })
  await act(async () => {
    resolveAlice(alice)
  })
  expect(username).toHaveProperty('value', 'bob-edited')
  fireEvent.click(editAlice)
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Username' })).toHaveProperty('value', 'alice'))
})

it('submits ChannelEditor on Ctrl+Enter and syncs ChannelsPage search filters with URL parameters', async () => {
  request.mockImplementation(async (url: string) => {
    if (url === '/api/user/self') return user
    if (url === '/api/status') return { quota_per_unit: 500000, quota_display_type: 'TOKENS' }
    if (url.startsWith('/api/channel/')) return { items: [], total: 0 }
    return []
  })
  const editorView = await mount(
    <ChannelEditor initial={{ ...newChannel, id: 5, name: 'Shortcut Channel', models: 'gpt-4o' }} sensitive pluginBind ownerId={1} onClose={vi.fn()} />
  )
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Models' }), { key: 'Enter', ctrlKey: true })
  await waitFor(() => expect(request.mock.calls.some(([url, options]) => url === '/api/channel' && options?.method === 'PUT')).toBe(true))
  editorView.unmount()

  window.history.replaceState(null, '', '/channels?page=2&q=openai&status=1')
  await mount(<ChannelsPage />)
  await waitFor(() =>
    expect(
      request.mock.calls.some(([url]) => typeof url === 'string' && url.includes('/api/channel/search?p=2') && url.includes('keyword=openai') && url.includes('status=1'))
    ).toBe(true)
  )
  const searchInput = screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement
  expect(searchInput.value).toBe('openai')
  fireEvent.change(searchInput, { target: { value: 'claude' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(window.location.search).toContain('q=claude')
  expect(window.location.search).not.toContain('page=2')
})

it('syncs RedemptionsPage filters with URL and previews raw quota on Amount (USD)', async () => {
  request.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/api/user/self') return user
    if (url === '/api/status') return { quota_per_unit: 500000, quota_display_type: 'TOKENS' }
    if (url === '/api/user/topup/info') return { payment_compliance_confirmed: true }
    if (url.startsWith('/api/redemption') && options?.method === 'POST') return ['CODE-1']
    if (url.startsWith('/api/redemption')) {
      return {
        items: [{ id: 1, user_id: 1, name: 'Promo', key: 'CODE-1', status: 1, quota: 500000, created_time: 1700000000, redeemed_time: 0, expired_time: 0, used_user_id: 0 }],
        total: 1,
      }
    }
    return []
  })
  window.history.replaceState(null, '', '/redemptions?page=2&q=promo&status=1')
  await mount(<RedemptionsPage />)
  await waitFor(() =>
    expect(
      request.mock.calls.some(([url]) => typeof url === 'string' && url.includes('/api/redemption/search?p=2') && url.includes('keyword=promo') && url.includes('status=1'))
    ).toBe(true)
  )
  expect((screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement).value).toBe('promo')
  expect(screen.getByRole('columnheader', { name: 'Actions' }).className).toContain('table-sticky-action')

  fireEvent.click(screen.getByRole('button', { name: 'Generate codes' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Name' }), { target: { value: 'Spring' } })
  const amountInput = screen.getByRole('spinbutton', { name: 'Amount (USD)' })
  fireEvent.change(amountInput, { target: { value: '2' } })
  expect(screen.getByText(/\$2 · 1,000,000 Raw quota/)).toBeTruthy()
  fireEvent.keyDown(amountInput, { key: 'Enter', ctrlKey: true })
  await waitFor(() => expect(request.mock.calls.some(([url, options]) => url === '/api/redemption' && options?.method === 'POST')).toBe(true))
})
