// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { Catalog } from '@/lib/api/types'
import { CatalogPage } from './catalog-page'
import { CatalogRouteList } from './catalog-route-list'
import { catalogVideoEntries } from './video-billing'
import { modelHref } from './model-card'

const performanceFailure = vi.hoisted(() => ({ active: false, refetch: vi.fn() }))
const usageFixture = vi.hoisted(() => ({ mode: 'ready' as 'ready' | 'disabled' | 'error' }))

const catalog = {
  currency: 'CNY',
  models: [
    {
      model_key: 'model/test',
      configured_model_id: 'test',
      name: 'Test model',
      provider: 'Example',
      modality: 'text',
      context_window: null,
      max_output_tokens: null,
      capabilities: [],
      offerings_count: 2,
      price_summary: [],
      offerings: [
        { offering_key: 'first', name: 'default', invocation_id: 'test', prices: [], access: [{ protocols: ['openai-response'] }] },
        { offering_key: 'second', name: 'vip', invocation_id: 'test-vip', prices: [], access: [{ protocols: ['anthropic'] }] },
      ],
    },
  ],
} as unknown as Catalog
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle: null }), refreshSession: vi.fn() }))
vi.mock('@/lib/api/client', () => ({
  api: async (path: string) => {
    if (!path.startsWith('/api/catalog/usage')) return catalog
    if (usageFixture.mode === 'error') throw new Error('Unavailable')
    return {
      enabled: usageFixture.mode === 'ready',
      models: usageFixture.mode === 'ready' ? [{ model_name: 'test', requests: 12, tokens: 345 }] : [],
    }
  },
}))
vi.mock('@/features/performance/use-performance', () => ({
  usePerformanceOverview: () => ({ data: { models: [], summary: {} }, isError: false }),
  useModelPerformance: () => ({
    data: {
      groups: [
        { group: 'default', success_rate: 98, avg_ttft_ms: 0, has_ttft: false, avg_tps: 0, has_tps: false, series: [] },
        { group: 'vip', success_rate: 0, avg_ttft_ms: 125, has_ttft: true, avg_tps: 42, has_tps: true, series: [] },
      ],
    },
    isPending: false,
    isError: performanceFailure.active,
    refetch: performanceFailure.refetch,
  }),
}))
vi.mock('./catalog-notices', () => ({ CatalogNotices: () => null }))
afterEach(() => {
  cleanup()
  performanceFailure.active = false
  performanceFailure.refetch.mockClear()
  usageFixture.mode = 'ready'
})

it('gives each video billing entry its own title, link, and route tiers', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const model = {
    ...catalog.models[0],
    modality: 'video',
    offerings: [
      { ...catalog.models[0].offerings[0], name: '按秒·稳定', availability: 'available' },
      { ...catalog.models[0].offerings[1], name: '按条·特价', availability: 'available' },
    ],
  }
  const [perVideo, perSecond] = catalogVideoEntries(model, i18n.t.bind(i18n))
  expect(perVideo.name).toBe('Test model (per request)')
  expect(perSecond.name).toBe('Test model (per second)')
  expect(modelHref(perVideo)).toContain('billing=request')
  expect(modelHref(perSecond)).toContain('billing=second')
  render(
    <I18nextProvider i18n={i18n}>
      <table>
        <tbody>
          <CatalogRouteList model={perSecond} groups={[]} currency="CNY" />
        </tbody>
      </table>
    </I18nextProvider>
  )
  const stable = screen.getByRole('link', { name: 'Stable video route' })
  expect(stable.getAttribute('href')).toContain(encodeURIComponent('按秒·稳定'))
  expect(screen.queryByRole('link', { name: 'Special video route' })).toBeNull()
  expect(screen.getByText('Backup video route')).toBeTruthy()
  expect(screen.getAllByText('Not available')).toHaveLength(2)
  expect(screen.getAllByRole('link', { name: /Create Key for this route/ })).toHaveLength(1)
})

it('uses friendly video route labels while filtering and links retain configured IDs', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'zh', resources: { zh: { translation: { 'Special price route': '特价版', 'Stable route': '稳定版' } } } })
  const model = {
    ...catalog.models[0],
    offerings: catalog.models[0].offerings.map((route, index) => ({ ...route, name: index ? 'video-stable' : 'video-special' })),
  }
  render(
    <I18nextProvider i18n={i18n}>
      <table>
        <tbody>
          <CatalogRouteList model={model} groups={['video-stable']} currency="USD" />
        </tbody>
      </table>
    </I18nextProvider>
  )
  expect(screen.queryByText('特价版')).toBeNull()
  const details = screen.getByRole('link', { name: '稳定版' })
  expect(details.getAttribute('href')).toContain('group=video-stable')
  expect(screen.getByRole('link', { name: /Quick connect/ }).getAttribute('href')).toContain('group=video-stable')
  expect(screen.getByRole('link', { name: /Create Key for this route/ }).getAttribute('href')).toContain('group=video-stable')
})

it('groups one model by resolution, billing mode and route', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const model = {
    ...catalog.models[0],
    modality: 'video',
    offerings: [
      { ...catalog.models[0].offerings[0], name: '720p·按秒·稳定', availability: 'available' },
      { ...catalog.models[0].offerings[1], name: '1080p·按次·特价', invocation_id: 'test', availability: 'available' },
    ],
  }
  const entries = catalogVideoEntries(model, i18n.t.bind(i18n))
  expect(entries).toEqual([model])
  render(
    <I18nextProvider i18n={i18n}>
      <table>
        <tbody>
          <CatalogRouteList model={entries[0]} groups={[]} currency="CNY" />
        </tbody>
      </table>
    </I18nextProvider>
  )
  const hd = screen.getByRole('heading', { name: '720P' }).parentElement!
  const fullHd = screen.getByRole('heading', { name: '1080P' }).parentElement!
  expect(within(hd).getByRole('heading', { name: 'Per second' })).toBeTruthy()
  expect(within(fullHd).getByRole('heading', { name: 'Per request' })).toBeTruthy()
  expect(within(hd).getByRole('link', { name: 'Stable video route' }).getAttribute('href')).toContain(encodeURIComponent('720p·按秒·稳定'))
  expect(within(fullHd).getByRole('link', { name: 'Special video route' }).getAttribute('href')).toContain(encodeURIComponent('1080p·按次·特价'))
})

it('shows disabled usage without inventing zero values', async () => {
  usageFixture.mode = 'disabled'
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CatalogPage initial={catalog} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(await screen.findByText('Disabled')).toBeTruthy()
  expect(screen.queryByText('345 Tokens')).toBeNull()
})

it('allows retrying usage statistics after a failed request', async () => {
  usageFixture.mode = 'error'
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CatalogPage initial={catalog} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(await screen.findByText('Something went wrong')).toBeTruthy()
  usageFixture.mode = 'ready'
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('345 Tokens')).toBeTruthy()
})

it('offers a retry when route performance cannot be loaded', async () => {
  performanceFailure.active = true
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <table>
        <tbody>
          <CatalogRouteList model={catalog.models[0]} groups={[]} currency="CNY" />
        </tbody>
      </table>
    </I18nextProvider>
  )
  expect(screen.getAllByText('Performance unavailable').length).toBeGreaterThan(0)
  fireEvent.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Retry' }))
  expect(performanceFailure.refetch).toHaveBeenCalledOnce()
})

it('expands each model route in place and preserves the selected route in links', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CatalogPage initial={catalog} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(await screen.findByText('345 Tokens')).toBeTruthy()
  expect(screen.getByText('12')).toBeTruthy()
  const button = await screen.findByRole('button', { name: 'Routes Test model' })
  expect(button.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(button)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByText('test-vip')).toBeTruthy()
  expect(screen.getByText('98%')).toBeTruthy()
  expect(screen.getByText('0%')).toBeTruthy()
  const defaultRoute = within(screen.getAllByRole('article')[0])
  expect(defaultRoute.queryByText('Time to first token')).toBeNull()
  expect(defaultRoute.queryByText('Output speed')).toBeNull()
  expect(screen.getByRole('link', { name: 'vip' }).getAttribute('href')).toContain('group=vip')
  expect(screen.getAllByRole('link', { name: /Quick connect/ })[1].getAttribute('href')).toContain('offering=second')
  fireEvent.click(button)
  expect(screen.queryByText('test-vip')).toBeNull()
})

it('shows only selected groups and preserves the display currency', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <table>
        <tbody>
          <CatalogRouteList model={catalog.models[0]} groups={['vip']} currency="USD" />
        </tbody>
      </table>
    </I18nextProvider>
  )
  expect(screen.queryByText('default')).toBeNull()
  expect(screen.getByText('125 ms')).toBeTruthy()
  expect(screen.getByText('42 tokens/s')).toBeTruthy()
  expect(screen.getByText('Protocol: anthropic')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'vip' }).getAttribute('href')).toContain('currency=USD')
  expect(screen.getByRole('link', { name: /Create Key for this route/ }).getAttribute('href')).toContain('group=vip')
})
