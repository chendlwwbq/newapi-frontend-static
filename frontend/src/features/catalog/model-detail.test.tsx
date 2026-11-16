import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { AuthBundle, CatalogModel } from '@/lib/api/types'
import { catalogModelKey } from './catalog-state'
import { ModelDetail } from './model-detail'

const bundle = { user: { id: 8, group: 'vip' }, session: { sid: 'member-session' } } as AuthBundle
let performanceData: unknown = undefined
let performanceError = false
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle }), refreshSession: vi.fn() }))
vi.mock('@/features/performance/use-performance', () => ({ useModelPerformance: () => ({ data: performanceData, isError: performanceError }) }))
vi.mock('@/features/performance/model-performance', () => ({ ModelPerformance: () => null }))
vi.mock('@/features/developer/published-documentation', () => ({ ModelDocumentation: () => null }))
vi.mock('./catalog-notices', () => ({ CatalogNotices: () => null }))
vi.mock('./price-breakdown', () => ({ PriceBreakdown: () => null }))

describe('model details route selection', () => {
  it('does not display stale route measurements when the performance request fails', async () => {
    const model = {
      model_key: 'model/private',
      configured_model_id: 'private',
      name: 'Private',
      provider: 'Example',
      description: '',
      offerings_count: 1,
      offerings: [{ offering_key: 'route-vip', name: 'vip', invocation_id: 'private', public_description: '', prices: [], access: [] }],
    } as unknown as CatalogModel
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/private', 'CNY', bundle), { model })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    performanceData = {
      groups: [{ group: 'vip', success_rate: 98, avg_latency_ms: 100, avg_tps: 5, avg_ttft_ms: 10, has_tps: true, has_ttft: true, series: [] }],
    }
    performanceError = true
    try {
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={client}>
            <ModelDetail modelId="model/private" catalogKey="model/private" />
          </QueryClientProvider>
        </I18nextProvider>
      )
      expect(html).toContain('Performance unavailable')
      expect(html).not.toContain('98 %')
    } finally {
      performanceData = undefined
      performanceError = false
    }
  })
  it('distinguishes missing performance samples from real zero measurements', async () => {
    const model = {
      model_key: 'model/private',
      configured_model_id: 'private',
      name: 'Private',
      provider: 'Example',
      description: '',
      offerings_count: 1,
      offerings: [{ offering_key: 'route-vip', name: 'vip', invocation_id: 'private', public_description: '', prices: [], access: [] }],
    } as unknown as CatalogModel
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/private', 'CNY', bundle), { model })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const render = () =>
      renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={client}>
            <ModelDetail modelId="model/private" catalogKey="model/private" />
          </QueryClientProvider>
        </I18nextProvider>
      )
    performanceData = {
      groups: [{ group: 'vip', success_rate: 0, avg_latency_ms: 100, avg_tps: 0, avg_ttft_ms: 0, has_tps: false, has_ttft: false, series: [] }],
    }
    const missing = render()
    expect(missing).toContain('0 %')
    expect(missing.match(/No measurements yet/g)).toHaveLength(2)
    performanceData = {
      groups: [{ group: 'vip', success_rate: 0, avg_latency_ms: 100, avg_tps: 5, avg_ttft_ms: 0, has_tps: true, has_ttft: true, series: [] }],
    }
    expect(render()).toContain('0 ms')
    performanceData = undefined
  })
  it('opens the first available route when the model arrives after authentication', async () => {
    const model = {
      model_key: 'model/private',
      configured_model_id: 'private',
      name: 'Private',
      provider: 'Example',
      description: '',
      offerings_count: 1,
      offerings: [{ offering_key: 'route-vip', name: 'vip', invocation_id: 'private', public_description: '', prices: [], access: [] }],
    } as unknown as CatalogModel
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/private', 'CNY', bundle), { model })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ModelDetail modelId="model/private" catalogKey="model/private" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('<details class="route-card" open="">')
    expect(html).toContain('offering=route-vip')
  })
  it('honors a filtered group and does not substitute another group when it is unavailable', async () => {
    const routes = ['default', 'vip'].map((name) => ({
      offering_key: `route-${name}`,
      name,
      invocation_id: 'private',
      public_description: '',
      prices: [],
      access: [],
    }))
    const model = {
      model_key: 'model/private',
      configured_model_id: 'private',
      name: 'Private',
      provider: 'Example',
      description: '',
      offerings_count: 2,
      offerings: routes,
    } as unknown as CatalogModel
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/private', 'CNY', bundle), { model })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const render = (initialGroup: string) =>
      renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={client}>
            <ModelDetail modelId="model/private" catalogKey="model/private" initialGroup={initialGroup} />
          </QueryClientProvider>
        </I18nextProvider>
      )
    expect(render('vip')).toContain('offering=route-vip')
    const missing = render('removed')
    expect(missing).toContain('Selected group is unavailable.')
    expect(missing).not.toContain('offering=route-default')
  })
  it('keeps route navigation on the yuan-priced catalog', async () => {
    const model = {
      model_key: 'model/private',
      configured_model_id: 'private',
      name: 'Private',
      provider: 'Example',
      description: '',
      offerings_count: 1,
      offerings: [{ offering_key: 'route-vip', name: 'vip', invocation_id: 'private', public_description: '', prices: [], access: [] }],
    } as unknown as CatalogModel
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/private', 'CNY', bundle), { model })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ModelDetail modelId="model/private" catalogKey="model/private" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('href="/pricing"')
    expect(html).not.toContain('currency=USD')
    expect(html).toContain('offering=route-vip')
  })
})
