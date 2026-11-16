// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { AuthBundle, CatalogModel } from '@/lib/api/types'
import { catalogModelKey } from './catalog-state'
import { ModelDetail } from './model-detail'
import { api } from '@/lib/api/client'

const bundle = { user: { id: 8, group: 'default' }, session: { sid: 'member' } } as AuthBundle
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle }), refreshSession: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ api: vi.fn(), apiResponse: async () => ({ data: [], group_ratio: {} }) }))
vi.mock('@/features/performance/use-performance', () => ({ useModelPerformance: () => ({}) }))
vi.mock('@/features/performance/model-performance', () => ({ ModelPerformance: () => null }))
vi.mock('@/features/developer/published-documentation', () => ({ ModelDocumentation: () => null }))
vi.mock('./catalog-notices', () => ({ CatalogNotices: () => null }))
vi.mock('./price-breakdown', () => ({ PriceBreakdown: () => null }))
vi.mock('@/features/docs/use-gateway-address', () => ({ useGatewayAddress: () => ({ address: 'https://gateway.test' }) }))
afterEach(cleanup)

it('keeps embedded examples scoped to the selected video route and copies its request', async () => {
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  const model = {
    model_key: 'kling/video',
    configured_model_id: 'kling-omni-4-0-second-line-a',
    name: 'Kling Omni 4.0',
    provider: 'Kling',
    modality: 'video',
    description: 'Reference image required',
    offerings_count: 2,
    offerings: ['default', 'vip'].map((name, index) => ({
      offering_key: name,
      name,
      invocation_id: index ? 'another-video-model' : 'kling-omni-4-0-second-line-a',
      public_description: '',
      prices: [],
      access: [{ protocols: ['openai_video'] }],
    })),
  } as unknown as CatalogModel
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  client.setQueryData(catalogModelKey(model.model_key, 'CNY', bundle), { model })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  window.history.replaceState(null, '', '/pricing/kling')
  try {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ModelDetail catalogKey={model.model_key} initialGroup="default" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(screen.getByRole('heading', { name: 'Request examples' })).toBeTruthy()
    expect(screen.queryByText('Time to first token')).toBeNull()
    expect(screen.queryByText('Context length')).toBeNull()
    const examples = container.querySelector('#model-request-examples')!
    expect(examples.textContent).toContain('reference_images')
    expect(examples.textContent).toContain('kling-omni-4-0-second-line-a')
    fireEvent.click(examples.querySelectorAll('.code-preview button')[1])
    await waitFor(() => expect(write).toHaveBeenCalledWith(expect.stringContaining('reference_images')))
    fireEvent.click(screen.getByText('vip', { selector: 'summary strong' }))
    expect(examples.textContent).toContain('another-video-model')
    expect(examples.textContent).not.toContain('kling-omni-4-0-second-line-a')
    fireEvent.change(screen.getByRole('combobox', { name: 'Example language' }), { target: { value: 'python' } })
    expect(examples.textContent).toContain('urllib.request')
  } finally {
    write.mockRestore()
  }
})

it('shows friendly video route labels while navigation and copied links retain real groups', async () => {
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  const routes = ['video-special', 'video-stable'].map((name) => ({
    offering_key: `route-${name}`,
    name,
    invocation_id: 'model',
    public_description: '',
    prices: [],
    access: [],
  }))
  const model = {
    model_key: 'model/video',
    configured_model_id: 'model',
    name: 'Video',
    provider: 'Provider',
    description: '',
    offerings_count: 2,
    offerings: routes,
  } as unknown as CatalogModel
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  client.setQueryData(catalogModelKey('model/video', 'CNY', bundle), { model })
  const i18n = createInstance()
  await i18n.init({ lng: 'zh', resources: { zh: { translation: { 'Special price route': '特价版', 'Stable route': '稳定版' } } } })
  window.history.replaceState(null, '', '/pricing/model?catalogKey=model%2Fvideo&group=video-special')
  try {
    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ModelDetail modelId="model/video" catalogKey="model/video" initialGroup="video-special" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(screen.getByText('特价版', { selector: 'summary strong' })).toBeTruthy()
    fireEvent.click(screen.getByText('稳定版', { selector: 'summary strong' }))
    expect(new URLSearchParams(window.location.search).get('group')).toBe('video-stable')
    expect(screen.getByRole('link', { name: /Quick connect/ }).getAttribute('href')).toContain('group=video-stable')
    expect(screen.getByRole('link', { name: 'Create Key for this route' }).getAttribute('href')).toContain('group=video-stable')
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(write).toHaveBeenCalled())
    expect(new URL(write.mock.calls.at(-1)![0]).searchParams.get('group')).toBe('video-stable')
  } finally {
    write.mockRestore()
  }
})

it('preserves route navigation without honoring legacy USD links', async () => {
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  const routes = ['default', 'CNY'].map((name) => ({
    offering_key: `route-${name}`,
    name,
    invocation_id: 'model',
    public_description: '',
    prices: [],
    access: [],
  }))
  const model = {
    model_key: 'model/test',
    configured_model_id: 'model',
    name: 'Test',
    provider: 'Provider',
    description: '',
    offerings_count: 2,
    offerings: routes,
  } as unknown as CatalogModel
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  client.setQueryData(catalogModelKey('model/test', 'CNY', bundle), { model })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  window.history.replaceState(null, '', '/pricing/model?catalogKey=model%2Ftest&group=default&currency=USD')
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModelDetail modelId="model/test" catalogKey="model/test" initialGroup="default" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(screen.getByText('CNY', { selector: 'summary strong' }))
  expect(new URLSearchParams(window.location.search).get('group')).toBe('CNY')
  expect(screen.getByRole('link', { name: /Quick connect/ }).getAttribute('href')).toContain('group=CNY')
  expect(screen.queryByRole('button', { name: '$ USD' })).toBeNull()
  expect(new URLSearchParams(window.location.search).has('currency')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
  await waitFor(() => expect(write).toHaveBeenCalled())
  const shared = new URL(write.mock.calls.at(-1)![0])
  expect(shared.pathname).toBe('/pricing/model')
  expect(shared.searchParams.get('catalogKey')).toBe('model/test')
  expect(shared.searchParams.get('group')).toBe('CNY')
  expect(shared.searchParams.has('currency')).toBe(false)
  write.mockRestore()
  window.history.replaceState(null, '', '/pricing/model?catalogKey=model%2Ftest&group=default&currency=USD')
  fireEvent(window, new PopStateEvent('popstate'))
  await waitFor(() => expect(screen.getByRole('link', { name: /Quick connect/ }).getAttribute('href')).toContain('group=default'))
})

it('requests a raw model ID explicitly when the link has no catalog key', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  vi.mocked(api).mockResolvedValueOnce({
    model: {
      model_key: 'model/model/foo',
      configured_model_id: 'model/foo',
      name: 'Model',
      provider: 'Example',
      description: '',
      offerings: [],
      offerings_count: 0,
    },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModelDetail modelId="model/foo" routeModel="model/foo" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalled())
  const url = String(vi.mocked(api).mock.calls.at(-1)?.[0])
  const params = new URLSearchParams(url.split('?')[1])
  expect(params.get('key')).toBe('model/foo')
  expect(params.get('key_type')).toBe('model_id')
})
