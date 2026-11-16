// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { Catalog } from '@/lib/api/types'
import { CatalogPage } from '../catalog-page'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'loading', bundle: null }), refreshSession: vi.fn() }))
vi.mock('@/features/performance/use-performance', () => ({ usePerformanceOverview: () => ({ isError: false }) }))

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/pricing')
})

it('shows active input modalities and removes one without clearing the others', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  window.history.replaceState(null, '', '/pricing?input=image&input=text')
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CatalogPage initial={{ currency: 'CNY', models: [] } as unknown as Catalog} />
      </QueryClientProvider>
    </I18nextProvider>
  )

  fireEvent.click(screen.getByRole('button', { name: 'Image' }))

  expect(new URLSearchParams(window.location.search).getAll('input')).toEqual(['text'])
})

it('shows a decorative vendor logo while keeping the provider checkbox usable', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const initial = {
    currency: 'CNY',
    models: [
      {
        model_key: 'model/gpt',
        configured_model_id: 'gpt',
        name: 'GPT',
        provider: 'OpenAI',
        modality: 'text',
        capabilities: [],
        offerings: [],
        price_summary: [],
        offerings_count: 0,
      },
    ],
  } as unknown as Catalog
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.replaceState(null, '', '/pricing')
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CatalogPage initial={initial} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const checkbox = screen.getByRole('checkbox', { name: /OpenAI/ })
  const logo = checkbox.closest('label')?.querySelector('img')
  expect(logo?.getAttribute('src')).toBe('/orbis/vendor-icons/openai.svg')
  expect(logo?.closest('[aria-hidden="true"]')).not.toBeNull()
  fireEvent.click(checkbox)
  expect(new URLSearchParams(window.location.search).getAll('provider')).toEqual(['OpenAI'])
})

it('expands and collapses a long provider list', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const models = Array.from({ length: 10 }, (_, index) => ({
    model_key: `model/${index}`,
    configured_model_id: `model-${index}`,
    name: `Model ${index}`,
    provider: `Vendor ${index}`,
    modality: 'text',
    capabilities: [],
    offerings: [],
    price_summary: [],
    offerings_count: 0,
  }))
  const initial = { currency: 'CNY', models } as unknown as Catalog
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CatalogPage initial={initial} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(screen.queryByRole('checkbox', { name: /Vendor 9/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Show all/ }))
  expect(screen.getByRole('checkbox', { name: /Vendor 9/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Collapse/ }))
  expect(screen.queryByRole('checkbox', { name: /Vendor 9/ })).toBeNull()
})

it('changes sorting while retaining active facets and resetting the page', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  window.history.replaceState(null, '', '/pricing?provider=OpenAI&input=text&page=3')
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CatalogPage initial={{ currency: 'CNY', models: [] } as unknown as Catalog} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('combobox', { name: 'Sort' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Output speed' }))
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('sort')).toBe('speed'))
  const params = new URLSearchParams(window.location.search)
  expect(params.getAll('provider')).toEqual(['OpenAI'])
  expect(params.getAll('input')).toEqual(['text'])
  expect(params.get('page')).toBeNull()
})

it('shows multiple routes as a disabled summary and clears only routes when all groups is selected', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  window.history.replaceState(null, '', '/pricing?group=default&group=vip&input=text&sort=speed&page=3')
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CatalogPage initial={{ currency: 'CNY', models: [] } as unknown as Catalog} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(screen.getByRole('combobox', { name: 'Routes' }).textContent).toBe('Routes · 2')
  fireEvent.click(screen.getByRole('combobox', { name: 'Routes' }))
  expect((await screen.findByRole('option', { name: 'Routes · 2' })).getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(screen.getByRole('option', { name: 'All groups' }))
  await waitFor(() => expect(new URLSearchParams(window.location.search).getAll('group')).toEqual([]))
  const params = new URLSearchParams(window.location.search)
  expect(params.getAll('input')).toEqual(['text'])
  expect(params.get('sort')).toBe('speed')
  expect(params.get('page')).toBeNull()
  fireEvent.click(within(screen.getByRole('complementary', { name: 'Filters' })).getByRole('button', { name: 'Reset filters' }))
  expect(window.location.search).toBe('')
})
