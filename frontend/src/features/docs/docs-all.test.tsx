// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import { DocsAll } from './docs-all'
import { DocsHub } from './docs-hub'
import { DocsPage } from './docs-page'
import { PublicHeader } from '@/components/layout/public-shell'

vi.mock('@/lib/api/client', () => ({
  api: async () => [{ id: 3, slug: 'custom', title: 'Custom guide', summary: 'Private gateway', language: 'en' }],
}))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle: null }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/docs/all', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('./use-gateway-address', () => ({ useGatewayAddress: () => ({ address: 'https://gateway.test', error: null, retry: vi.fn() }) }))
vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({ open }: { open: boolean }) =>
      open ? <div role="dialog">Global search</div> : null,
}))
afterEach(cleanup)

it('filters built-in and published guides by category and search', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <PublicHeader />
        <DocsAll />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search documentation' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(await screen.findByText('Custom guide')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Clients' }))
  expect(screen.getByText('Codex CLI')).toBeTruthy()
  expect(screen.queryByText('Custom guide')).toBeNull()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search documentation' }), { target: { value: 'Codex' } })
  expect(screen.getByText('Codex CLI')).toBeTruthy()
  expect(screen.queryByText('Claude Code')).toBeNull()
  fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search documentation' }), { key: 'Escape' })
  expect(screen.getByText('Claude Code')).toBeTruthy()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search documentation' }), { target: { value: 'Codex' } })
  fireEvent.click(screen.getByRole('button', { name: 'Developer documentation' }))
  expect(screen.getByRole('status')).toBeTruthy()
})

it('exposes a dedicated video guide on the help center and shows the gateway task flow', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const wrap = (child: ReactNode) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>{child}</QueryClientProvider>
    </I18nextProvider>
  )
  const hub = render(wrap(<DocsHub />))
  const videoLinks = screen.getAllByRole('link', { name: /Video generation/i })
  expect(videoLinks.some((link) => link.getAttribute('href') === '/docs/video-generation')).toBe(true)
  expect(videoLinks.some((link) => link.textContent?.includes('Integration guides'))).toBe(true)
  hub.unmount()
  render(wrap(<DocsPage slug="video-generation" />))
  expect(screen.getByRole('heading', { name: 'Video generation', level: 1 })).toBeTruthy()
  const connection = screen.getByRole('heading', { name: 'Connection settings', level: 2 }).closest('section')
  expect(connection).not.toBeNull()
  expect(within(connection!).getByText(/depend on each model and channel configuration/)).toBeTruthy()
  expect(screen.getByText(/v1\/videos\/TASK_ID\/content/)).toBeTruthy()
  expect(screen.getByText(/Do not blindly resubmit/)).toBeTruthy()
})
