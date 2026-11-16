import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { CatalogModel, Offering } from '@/lib/api/types'
import { catalogListKey } from '@/features/catalog/catalog-state'
import { ApiReference } from './api-reference'
import { DocsPage } from './docs-page'
import { DocsHub } from './docs-hub'
import { guides } from './guides'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle: null }), refreshSession: vi.fn() }))
vi.mock('./use-gateway-address', () => ({ useGatewayAddress: () => ({ address: 'https://gateway.test' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

it('links the first-request step to the matching section after guide changes', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <DocsHub />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const index = guides['getting-started'].sections.findIndex((section) => section.title === 'Send a request')
  expect(index).toBeGreaterThanOrEqual(0)
  expect(html).toContain(`/docs/getting-started#section-${index}`)
})

it('identifies unverified client instructions as gateway information', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <DocsPage slug="windsurf" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('not a verified client configuration')
  expect(html).toContain('https://gateway.test/v1')
})

it('shows route metrics with understandable descriptions in the route guide', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <DocsPage slug="choose-route" />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('<table')
  expect(html).toContain('Time to first token')
  expect(html).toContain('Tokens generated per second during streaming')
})

it('keeps the selected catalog identity and group in the model details link', async () => {
  const offering = { name: 'vip +', invocation_id: 'model/a', access: [{ protocols: ['anthropic'] }] } as Offering
  const model = { model_key: 'model/distinct', configured_model_id: 'model/a', offerings: [offering] } as CatalogModel
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <ApiReference initialModel={model} offering={offering} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('/pricing/model%2Fa?catalogKey=model%2Fdistinct&amp;group=vip+%2B')
})

it('uses the first selectable route for its model identifier and protocols', async () => {
  const routes = [
    { offering_key: 'a', name: 'first', invocation_id: 'first-model', access: [{ protocols: ['anthropic'] }] },
    { offering_key: 'b', name: 'second', invocation_id: 'second-model', access: [{ protocols: ['gemini'] }] },
  ] as Offering[]
  const model = { model_key: 'model/key', configured_model_id: 'base-model', name: 'Model', offerings: routes } as CatalogModel
  const client = new QueryClient()
  client.setQueryData(catalogListKey('CNY', null), { models: [model] })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ApiReference modelPicker />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('first-model')
  expect(html).toContain('Anthropic Messages')
  expect(html).not.toContain('Gemini GenerateContent')
  expect(html).toContain('group=first')
  expect(html).toContain('second')
})

it('does not show a generic request example for a model with no routes', async () => {
  const model = { model_key: 'model/key', configured_model_id: 'base-model', name: 'Model', offerings: [] } as unknown as CatalogModel
  const client = new QueryClient()
  client.setQueryData(catalogListKey('CNY', null), { models: [model] })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ApiReference modelPicker />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('No routes available')
  expect(html).not.toContain('Chat Completions')
  expect(html).not.toContain('your-model')
})

it('shows a video request and task guide for a supported video route', async () => {
  const offering = { name: 'video', invocation_id: 'video-model', access: [{ protocols: ['openai-video'] }] } as Offering
  const model = { model_key: 'model/video', configured_model_id: 'video-model', offerings: [offering] } as CatalogModel
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <ApiReference initialModel={model} offering={offering} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('https://gateway.test/v1/videos')
  expect(html).toContain('export NEW_API_KEY=')
  expect(html).toContain('YOUR_API_KEY')
  expect(html).toContain('cURL · PowerShell 7')
  expect(html).toContain('video-model')
  expect(html).toContain('/docs/async-tasks')
  expect(html).not.toContain('/v1/chat/completions')
})

it('shows the alpha search endpoint without inventing a request body', async () => {
  const offering = { name: 'search', invocation_id: 'model-a', access: [{ protocols: ['openai-alpha-search'] }] } as Offering
  const model = { model_key: 'model/a', configured_model_id: 'model-a', offerings: [offering] } as CatalogModel
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <ApiReference initialModel={model} offering={offering} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('https://gateway.test/v1/alpha/search')
  expect(html).toContain('without a built-in example')
  expect(html).not.toContain('/v1/chat/completions')
  expect(html).not.toContain('Authorization: Bearer')
})
