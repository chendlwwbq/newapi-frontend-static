import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { AuthBundle } from '@/lib/api/types'
import { catalogModelKey } from './catalog-state'
import { ConnectPage } from './connect-page'

const bundle = { user: { id: 8, group: 'vip' }, session: { sid: 'member' } } as AuthBundle
let currentBundle: AuthBundle | null = bundle
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle: currentBundle }), refreshSession: vi.fn() }))
vi.mock('@/features/docs/use-gateway-address', () => ({ useGatewayAddress: () => ({ address: 'https://gateway.test' }) }))
vi.mock('@/features/docs/api-reference', () => ({ ApiReference: () => null }))

describe('connection addresses', () => {
  afterEach(() => {
    currentBundle = bundle
  })
  it('labels video groups without changing the key creation or return route', async () => {
    currentBundle = null
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/video', 'CNY', null), {
      model: { offerings: [{ offering_key: 'route-stable', name: 'video-stable', invocation_id: 'video', access: [] }] },
    })
    const i18n = createInstance()
    await i18n.init({ lng: 'zh', resources: { zh: { translation: { 'Stable route': '稳定版' } } } })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ConnectPage model="video" group="video-stable" catalogKey="model/video" offeringKey="route-stable" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('<strong>稳定版</strong>')
    expect(html).toContain('/keys?create=1&amp;group=video-stable')
    expect(html).toContain('group=video-stable')
    expect(html).not.toContain('group=%E7%A8%B3')
  })
  it('shows manual client settings to visitors and keeps the selected route in the sign-in link', async () => {
    currentBundle = null
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/example', 'CNY', null), {
      model: {
        offerings: [{ offering_key: 'route-vip', name: 'vip', invocation_id: 'example', access: [{ protocols: ['openai-response', 'anthropic'] }] }],
      },
    })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ConnectPage model="example" group="vip" catalogKey="model/example" offeringKey="route-vip" currency="USD" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('~/.codex/eva.config.toml')
    expect(html).toContain('ANTHROPIC_BASE_URL')
    expect(html).toContain(
      '/sign-in?redirect=%2Fpricing%2Fexample%2Fconnect%3Fgroup%3Dvip%26catalogKey%3Dmodel%252Fexample%26offering%3Droute-vip%26currency%3DUSD'
    )
    expect(html).not.toContain('Choose an API key')
  })
  it('shows the Codex profile file and command for a Responses route', async () => {
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/example', 'CNY', bundle), {
      model: { offerings: [{ offering_key: 'route-vip', name: 'vip', invocation_id: 'example', access: [{ protocols: ['openai-response'] }] }] },
    })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ConnectPage model="example" group="vip" catalogKey="model/example" offeringKey="route-vip" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('~/.codex/eva.config.toml')
    expect(html).toContain('codex --profile eva')
  })
  it('shows the selected Anthropic endpoint without presenting an OpenAI base', async () => {
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/example', 'CNY', bundle), {
      model: { offerings: [{ offering_key: 'route-vip', name: 'vip', invocation_id: 'example', access: [{ protocols: ['anthropic'] }] }] },
    })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ConnectPage model="example" group="vip" catalogKey="model/example" offeringKey="route-vip" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('https://gateway.test/v1/messages')
    expect(html).toContain('CC Switch')
    expect(html).toContain('Claude Code')
    expect(html).not.toContain('Codex CLI')
    expect(html).not.toContain('OpenAI · Base URL')
    expect(html).toContain('catalogKey=model%2Fexample')
  })
  it('preserves the display currency when returning to model details', async () => {
    const client = new QueryClient()
    client.setQueryData(catalogModelKey('model/example', 'CNY', bundle), {
      model: { offerings: [{ offering_key: 'route-vip', name: 'vip', invocation_id: 'example', access: [] }] },
    })
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ConnectPage model="example" group="vip" catalogKey="model/example" offeringKey="route-vip" currency="USD" />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('group=vip&amp;currency=USD')
    expect(html).not.toContain('CC Switch')
  })
})
