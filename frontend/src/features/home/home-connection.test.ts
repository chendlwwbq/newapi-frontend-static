import { describe, expect, it, vi } from 'vitest'
import type { CatalogModel, Offering } from '@/lib/api/types'
import { homeConnection } from './home-connection'
import { catalogListKey, catalogModelKey, connectReturnPath, connectRoute } from '@/features/catalog/catalog-state'
import { exampleRoute } from '@/features/docs/api-examples'
import { consoleReturnPath } from '@/features/auth/console-return'
import type { AuthBundle } from '@/lib/api/types'
import { publicModuleApi } from '@/lib/api/server'
import ModelPage from '@/app/(public)/pricing/[model]/page'
import ConnectRoutePage from '@/app/(public)/pricing/[model]/connect/page'

vi.mock('@/lib/api/server', () => ({ publicModuleApi: vi.fn() }))

const route = (key: string, name: string): Offering => ({
  offering_key: key,
  name,
  invocation_id: 'model',
  public_description: '',
  availability: 'available',
  prices: [],
  metrics: [],
  access: [],
})
const model = (key: string, routes: Offering[]): CatalogModel => ({
  model_key: key,
  configured_model_id: key,
  name: key,
  provider: '',
  description: '',
  modality: 'text',
  icon: '',
  context_window: null,
  max_output_tokens: null,
  offerings: routes,
  offerings_count: routes.length,
  price_summary: [],
  metrics: [],
  capabilities: [],
  input_modalities: [],
  output_modalities: [],
})
const alpha = model('alpha', [route('a-default', 'default'), route('a-special', 'group + /测试')]),
  beta = model('beta', [route('b-default', 'other')])

describe('home connection selection', () => {
  it('starts with a real model and route', () => {
    const selected = homeConnection([alpha, beta], { model: '', offering: '' })
    expect(selected?.model).toBe(alpha)
    expect(selected?.offering?.offering_key).toBe('a-default')
  })
  it('keeps the selected route and preserves its exact group in key and guide URLs', () => {
    const selected = homeConnection([alpha], { model: 'alpha', offering: 'a-special' })!
    expect(new URL(selected.keyHref!, 'https://eva.test').searchParams.get('group')).toBe('group + /测试')
    const params = new URL(selected.connectHref!, 'https://eva.test').searchParams
    expect(params.get('offering')).toBe('a-special')
    expect(params.get('catalogKey')).toBe('alpha')
  })
  it('resets a route belonging to another model', () => {
    expect(homeConnection([alpha, beta], { model: 'beta', offering: 'a-special' })?.offering?.offering_key).toBe('b-default')
  })
  it('resolves removed models and removed routes from the new catalog', () => {
    expect(homeConnection([beta], { model: 'alpha', offering: 'a-special' })?.model).toBe(beta)
    expect(homeConnection([alpha], { model: 'alpha', offering: 'removed' })?.offering?.offering_key).toBe('a-default')
  })
  it('does not invent a default route or key action for a routeless model', () => {
    expect(homeConnection([model('empty', [])], { model: '', offering: '' })).toMatchObject({ offering: null, keyHref: null, connectHref: null })
  })
  it('handles an empty or restricted catalog without a fake model', () => {
    expect(homeConnection([], { model: '', offering: '' })).toBeNull()
  })
  it('encodes model IDs separately from route query parameters', () => {
    const special = model('vendor/model ?#', [route('route?x#y', 'vip')])
    expect(homeConnection([special], { model: '', offering: '' })?.connectHref?.startsWith('/pricing/vendor%2Fmodel%20%3F%23/connect?')).toBe(true)
  })
  it('does not substitute a different route when the requested group is unavailable', () => {
    expect(connectRoute(alpha, 'missing')).toBeUndefined()
    expect(connectRoute(alpha, 'group + /测试')?.offering_key).toBe('a-special')
    expect(connectRoute(alpha)?.offering_key).toBe('a-default')
  })
  it('uses the selected offering and rejects stale or mismatched selections', () => {
    const shared = model('shared', [route('first', 'vip'), route('second', 'vip')])
    expect(connectRoute(shared, 'vip', 'second')?.offering_key).toBe('second')
    expect(connectRoute(shared, 'vip', 'removed')).toBeUndefined()
    expect(connectRoute(shared, 'other', 'second')).toBeUndefined()
  })
  it('passes the selected offering from the connection URL to the page', async () => {
    const page = await ConnectRoutePage({
      params: Promise.resolve({ model: 'alpha' }),
      searchParams: Promise.resolve({ group: 'vip', catalogKey: 'alpha', offering: 'route /?#' }),
    })
    expect(page.props).toMatchObject({ model: 'alpha', group: 'vip', catalogKey: 'alpha', offeringKey: 'route /?#' })
  })
  it('isolates model details by account group and session', () => {
    const member = { user: { id: 1, group: 'vip' }, session: { sid: 'session-a' } } as AuthBundle
    expect(catalogModelKey('alpha', 'CNY', member)).not.toEqual(catalogModelKey('alpha', 'CNY', null))
    expect(catalogModelKey('model/alpha', 'CNY', member, 'catalog_key')).not.toEqual(catalogModelKey('model/alpha', 'CNY', member, 'model_id'))
    expect(catalogModelKey('alpha', 'CNY', member)).not.toEqual(catalogModelKey('alpha', 'CNY', { ...member, session: { sid: 'session-b' } }))
    expect(catalogModelKey('alpha', 'CNY', member)).not.toEqual(
      catalogModelKey('alpha', 'CNY', { ...member, user: { ...member.user, group: 'other' } })
    )
  })
  it('isolates the shared catalog across anonymous, group and session changes', () => {
    const member = { user: { id: 1, group: 'vip' }, session: { sid: 'session-a' } } as AuthBundle
    expect(catalogListKey('CNY', member)).not.toEqual(catalogListKey('CNY', null))
    expect(catalogListKey('CNY', member)).not.toEqual(catalogListKey('CNY', { ...member, session: { sid: 'session-b' } }))
    expect(catalogListKey('CNY', member)).not.toEqual(catalogListKey('CNY', { ...member, user: { ...member.user, group: 'other' } }))
  })
  it('keeps the selected group for sign-in while discarding unrelated query parameters', () => {
    const redirect = consoleReturnPath('/keys', '?create=1&group=vip%20%2B%20test&secret=discard')
    const parsed = new URL(redirect, 'https://eva.test')
    expect(parsed.pathname).toBe('/keys')
    expect(parsed.searchParams.get('create')).toBe('1')
    expect(parsed.searchParams.get('group')).toBe('vip + test')
    expect(parsed.searchParams.has('secret')).toBe(false)
    expect(consoleReturnPath('/keys', '?create=1&group=%2F%2Fevil.example')).toBe('/keys?create=1&group=%2F%2Fevil.example')
    expect(consoleReturnPath('/keys', '?create=0&group=vip')).toBe('/keys')
    expect(consoleReturnPath('/keys', '?group=vip')).toBe('/keys')
    expect(consoleReturnPath('/wallet', '?create=1&group=vip')).toBe('/wallet')
  })
  it('keeps model, catalog key and group when sign-in resumes a connection guide', () => {
    const redirect = connectReturnPath('vendor/model ?#', 'vip + /测试', 'model/vendor/model', 'route /?#')
    const parsed = new URL(redirect, 'https://eva.test')
    expect(parsed.origin).toBe('https://eva.test')
    expect(parsed.pathname).toBe('/pricing/vendor%2Fmodel%20%3F%23/connect')
    expect(parsed.searchParams.get('group')).toBe('vip + /测试')
    expect(parsed.searchParams.get('catalogKey')).toBe('model/vendor/model')
    expect(parsed.searchParams.get('offering')).toBe('route /?#')
    expect(new URL(connectReturnPath('//evil.example', 'x&redirect=https://evil.example'), 'https://eva.test').origin).toBe('https://eva.test')
    expect(connectReturnPath('alpha')).toBe('/pricing/alpha/connect')
  })
  it('builds examples with only the selected route protocols and invocation ID', () => {
    const first = { ...route('first', 'default'), invocation_id: 'upstream-one', access: [{ protocols: ['openai'] }] }
    const second = { ...route('second', 'vip'), invocation_id: 'upstream-two', access: [{ protocols: ['anthropic'] }] }
    const scope = exampleRoute(model('alpha', [first, second]), second)
    expect(scope.modelId).toBe('upstream-two')
    expect([...scope.protocols]).toEqual(['anthropic'])
    expect(scope.routes.map((item) => item.name)).toEqual(['vip'])
  })
  it('allows client lookup when a model is absent from the anonymous server catalog', async () => {
    vi.mocked(publicModuleApi).mockResolvedValueOnce({ models: [alpha], total: 1, currency: 'CNY', schema_version: 1 })
    const page = await ModelPage({ params: Promise.resolve({ model: 'private-model' }) })
    expect(page.props.modelId).toBe('private-model')
    expect(page.props.initial).toBeUndefined()
  })
  it('does not confuse a model ID with another model catalog key during server rendering', async () => {
    const first = { ...alpha, model_key: 'model/foo', configured_model_id: 'foo' }
    const target = { ...alpha, model_key: 'model/model/foo', configured_model_id: 'model/foo' }
    vi.mocked(publicModuleApi).mockResolvedValueOnce({ models: [first, target], total: 2, currency: 'CNY', schema_version: 1 })
    const page = await ModelPage({ params: Promise.resolve({ model: 'model/foo' }) })
    expect(page.props.initial).toBe(target)
    vi.mocked(publicModuleApi).mockResolvedValueOnce({ models: [first], total: 1, currency: 'CNY', schema_version: 1 })
    const missing = await ModelPage({ params: Promise.resolve({ model: 'model/foo' }) })
    expect(missing.props.initial).toBeUndefined()
    expect(missing.props.modelId).toBe('model/foo')
  })
  it('uses an explicit catalog key for the server projection and later client lookup', async () => {
    const duplicate = { ...alpha, model_key: 'model/other' }
    vi.mocked(publicModuleApi).mockResolvedValueOnce({ models: [alpha, duplicate], total: 2, currency: 'CNY', schema_version: 1 })
    const page = await ModelPage({
      params: Promise.resolve({ model: 'alpha' }),
      searchParams: Promise.resolve({ catalogKey: 'model/other', group: 'vip' }),
    })
    expect(page.props.initial).toBe(duplicate)
    expect(page.props.modelId).toBe('model/other')
    expect(page.props.initialGroup).toBe('vip')
    vi.mocked(publicModuleApi).mockResolvedValueOnce({ models: [alpha], total: 1, currency: 'CNY', schema_version: 1 })
    const missing = await ModelPage({ params: Promise.resolve({ model: 'alpha' }), searchParams: Promise.resolve({ catalogKey: 'model/private' }) })
    expect(missing.props.initial).toBeUndefined()
    expect(missing.props.modelId).toBe('model/private')
  })
})
