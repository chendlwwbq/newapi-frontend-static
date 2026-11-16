// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { CatalogModel, Quote } from '@/lib/api/types'
import { groupSeedanceModels, isSeedanceFamily, routeCatalogModel } from '../seedance-families'
import { CatalogPage } from '../catalog-page'
import { ModelDetail } from '../model-detail'
import { catalogModelKey, filterCatalog, readCatalogFilters } from '../catalog-state'
import { applicableNotices } from '../notice-state'
import { api } from '@/lib/api/client'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle: null }), refreshSession: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ api: vi.fn(), apiResponse: async () => ({ data: [], group_ratio: { 视频按秒: 1 } }) }))
vi.mock('@/features/performance/use-performance', () => ({ useModelPerformance: () => ({}), usePerformanceOverview: () => ({}) }))
vi.mock('@/features/performance/model-performance', () => ({ ModelPerformance: () => null }))
vi.mock('@/features/developer/published-documentation', () => ({ ModelDocumentation: () => null }))
vi.mock('../catalog-notices', () => ({ CatalogNotices: () => null }))
vi.mock('@/features/docs/use-gateway-address', () => ({ useGatewayAddress: () => ({ address: 'https://gateway.test' }) }))

function model(id: string, name: string, groups = ['视频按秒'], price = '0.25'): CatalogModel {
  const offerings = groups.map((group) => {
    const quote: Quote = { status: 'fixed', currency: 'CNY', group, components: [{ kind: 'request', amount: price, unit: 'second', quantity: 1 }] }
    return {
      offering_key: `${group}/${id}`,
      name: group,
      invocation_id: id,
      public_description: '',
      availability: 'available',
      prices: [quote],
      metrics: [],
      access: [{ protocols: ['openai_video'] }],
    }
  })
  return {
    model_key: `model/${id}`,
    configured_model_id: id,
    name,
    description: `${name}: reference images supported`,
    provider: 'ByteDance',
    icon: '',
    modality: 'video',
    context_window: null,
    max_output_tokens: null,
    offerings,
    offerings_count: offerings.length,
    price_summary: offerings.map((route) => ({ offering_key: route.offering_key, quote: route.prices[0] })),
    metrics: [],
    capabilities: [],
    input_modalities: ['text', 'image'],
    output_modalities: ['video'],
  }
}

const lineF = model('seedance-2-5-second-line-f', 'Seedance 2.5 · Line F', ['视频按秒'], '0.33')
const lineJ = model('seedance-2.5', 'Seedance 2.5 · Line J', ['视频按秒'], '0.40')

async function setup() {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  return { i18n, client }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
})

it('groups known per-second Seedance IDs into five families without changing prices or other groups', async () => {
  const { i18n } = await setup()
  const input = [
    model('seedance-2-0-mini-second-line-f', 'Mini'),
    model('seedance-2-0-mini-i2v-480p-720p-1080p', 'Mini frames'),
    model('seedance-2-0-fast-second-line-f', 'Fast'),
    model('seedance-2-0-second-line-f', '2.0'),
    lineF,
    lineJ,
    model('seedance-2-5-second-line-n', 'Full N', ['视频按秒'], '0.21'),
    model('seedance-2-5-flash-second', '2.5 Flash'),
    model('seedance-2-5-full-second', 'Full', ['视频按秒', 'private-customer']),
    model('seedance-2-0-fast-fixed-720p', 'Per request', ['视频按次']),
    model('seedance-2-5-cn-token-720p-1080p', 'Official', ['官转']),
    model('wan-3-second-line-f', 'WAN'),
  ]
  const before = JSON.stringify(input)
  const rows = groupSeedanceModels(input, i18n.t)
  expect(rows.filter((row) => isSeedanceFamily(row.model_key)).map((row) => row.name)).toEqual([
    'Seedance 2.0 Mini',
    'Seedance 2.0 Fast',
    'Seedance 2.0',
    'Seedance 2.5',
    'Seedance 2.5 Flash',
  ])
  const full = rows.find((row) => row.name === 'Seedance 2.5')!
  expect(full.offerings).toHaveLength(4)
  const lineN = full.offerings.find((route) => route.invocation_id === 'seedance-2-5-second-line-n')!
  expect(routeCatalogModel(full, lineN).configured_model_id).toBe('seedance-2-5-second-line-n')
  expect(lineN.prices[0].components[0].amount).toBe('0.21')
  expect(full.offerings[0].prices).toEqual(lineF.offerings[0].prices)
  expect(full.offerings.some((route) => route.catalog_label === '2.5 Flash')).toBe(false)
  const flash = rows.find((row) => row.name === 'Seedance 2.5 Flash')!
  expect(flash.offerings.map((route) => route.invocation_id)).toEqual(['seedance-2-5-flash-second'])
  expect(routeCatalogModel(flash, flash.offerings[0]).configured_model_id).toBe('seedance-2-5-flash-second')
  expect(full.offerings.every((route) => route.name === '视频按秒')).toBe(true)
  expect(rows.find((row) => row.name === 'Full')?.offerings.map((route) => route.name)).toEqual(['private-customer'])
  expect(rows.some((row) => row.name === 'Per request')).toBe(true)
  expect(rows.some((row) => row.name === 'Official')).toBe(true)
  expect(rows.some((row) => row.name === 'WAN')).toBe(true)
  expect(JSON.stringify(input)).toBe(before)
})

it('keeps stable and CS/JS routes under each existing family with their invocation IDs', async () => {
  const { i18n } = await setup()
  for (const family of ['2-0-mini', '2-0-fast', '2-0', '2-5']) {
    const ids = [`seedance-${family}-stable-second`, `seedance-${family}-second-line-l`, `seedance-${family}-second-line-m`]
    const rows = groupSeedanceModels(
      ids.map((id) => model(id, id)),
      i18n.t
    )
    expect(rows).toHaveLength(1)
    expect(isSeedanceFamily(rows[0].model_key)).toBe(true)
    expect(rows[0].offerings.map((route) => routeCatalogModel(rows[0], route).configured_model_id)).toEqual(ids)
  }
})

it('never invents unavailable routes and preserves exact-ID search and route notices', async () => {
  const { i18n } = await setup()
  expect(groupSeedanceModels([], i18n.t)).toEqual([])
  const rows = groupSeedanceModels([lineJ], i18n.t)
  expect(rows[0].offerings.map((route) => route.invocation_id)).toEqual(['seedance-2.5'])
  expect(routeCatalogModel(rows[0], rows[0].offerings[0]).model_key).toBe(lineJ.model_key)
  const both = groupSeedanceModels([lineF, lineJ], i18n.t)
  expect(filterCatalog(both, readCatalogFilters('q=seedance-2.5'))).toHaveLength(1)
  const notice = { public_message: 'Line J notice', models: [lineJ.model_key], offering_keys: [lineJ.offerings[0].offering_key] }
  expect(applicableNotices([notice], both)).toEqual([notice])
  expect(applicableNotices([notice], groupSeedanceModels([lineF], i18n.t))).toEqual([])
  const mismatched = { public_message: 'Different route', models: [lineF.model_key], offering_keys: [lineJ.offerings[0].offering_key] }
  expect(applicableNotices([mismatched], both)).toEqual([])
})

it('expands a single family row into independent route IDs and exact connection links', async () => {
  const { i18n, client } = await setup()
  const catalog = { models: [lineF, lineJ], currency: 'CNY' as const, total: 2, schema_version: 1 }
  vi.mocked(api).mockResolvedValue(catalog)
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CatalogPage initial={catalog} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const button = await screen.findByRole('button', { name: 'Routes Seedance 2.5' })
  expect(screen.getAllByRole('button', { name: /^Routes Seedance/ })).toHaveLength(1)
  fireEvent.click(button)
  const rows = screen.getAllByRole('article')
  expect(rows).toHaveLength(2)
  const second = within(rows[1])
  expect(second.getByText('seedance-2.5', { selector: 'code' })).toBeTruthy()
  const link = second.getByRole('link', { name: /Quick connect/ })
  const url = new URL(link.getAttribute('href')!, 'https://gateway.test')
  expect(url.pathname).toBe('/pricing/seedance-2.5/connect')
  expect(url.searchParams.get('catalogKey')).toBe(lineJ.model_key)
  expect(url.searchParams.get('offering')).toBe(lineJ.offerings[0].offering_key)
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  fireEvent.click(second.getByRole('button', { name: 'Copy' }))
  await waitFor(() => expect(copy).toHaveBeenCalledWith('seedance-2.5'))
  copy.mockRestore()
})

it('switches same-group routes together with price, examples, copy ID and browser history', async () => {
  const { i18n, client } = await setup()
  const familyKey = 'family/seedance-second/full'
  client.setQueryData(catalogModelKey(familyKey, 'CNY', null), { models: [lineF, lineJ] })
  window.history.replaceState(null, '', `/pricing/${lineF.configured_model_id}?catalogKey=${encodeURIComponent(familyKey)}&group=视频按秒`)
  const { container } = render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModelDetail catalogKey={familyKey} initialGroup="视频按秒" initialOffering={lineF.offerings[0].offering_key} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(screen.getByRole('heading', { name: 'Seedance 2.5', level: 1 })).toBeTruthy()
  expect(container.querySelector('#model-request-examples')?.textContent).toContain(lineF.configured_model_id)
  const lineJLabel = screen.getByText(/Seedance 2.5 · Line J/, { selector: 'summary strong' })
  fireEvent.click(lineJLabel)
  expect(container.querySelector('#model-request-examples')?.textContent).toContain('model=seedance-2.5')
  expect(container.querySelector('#model-request-examples')?.textContent).not.toContain(lineF.configured_model_id)
  expect(container.querySelector('details[open]')?.textContent).toContain('¥0.4')
  expect(container.querySelector('.detail-sidebar .model-id code')?.textContent).toBe('seedance-2.5')
  expect(new URLSearchParams(window.location.search).get('offering')).toBe(lineJ.offerings[0].offering_key)
  const connect = new URL(screen.getByRole('link', { name: /Quick connect/ }).getAttribute('href')!, 'https://gateway.test')
  expect(connect.searchParams.get('catalogKey')).toBe(lineJ.model_key)
  window.history.replaceState(
    null,
    '',
    `?catalogKey=${encodeURIComponent(familyKey)}&group=视频按秒&offering=${encodeURIComponent(lineF.offerings[0].offering_key)}`
  )
  fireEvent(window, new PopStateEvent('popstate'))
  expect(container.querySelector('.detail-sidebar .model-id code')?.textContent).toBe(lineF.configured_model_id)
})

it('does not silently substitute a different route when an explicit offering is unavailable', async () => {
  const { i18n, client } = await setup()
  const key = 'family/seedance-second/full'
  client.setQueryData(catalogModelKey(key, 'CNY', null), { models: [lineF] })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModelDetail catalogKey={key} initialGroup="视频按秒" initialOffering={lineJ.offerings[0].offering_key} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(screen.queryByRole('link', { name: /Quick connect/ })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Request examples' })).toBeNull()
})
