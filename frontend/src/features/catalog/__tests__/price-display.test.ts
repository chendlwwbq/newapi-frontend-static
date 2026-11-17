import { describe, it, expect } from 'vitest'
import { quoteUnitLabel, formatPrice } from '../price-format'
import type { Quote } from '@/lib/api/types'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { PriceBreakdown } from '../price-breakdown'
import { PriceDisplay } from '../model-card'
import type { PricingModel } from '@/features/pricing/types'
import chinese from '@/i18n/zh.json'
const quote: Quote = { currency: 'CNY', status: 'fixed', group: 'default', components: [] }
const videoGroupPricing: PricingModel = {
  id: 20,
  model_name: 'seedance-2-5-480p-second',
  quota_type: 0,
  model_ratio: 0,
  completion_ratio: 0,
  enable_groups: ['video-special', 'video-stable'],
  billing_expr: 'tier("base", u("seconds") * 9.99)',
  billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
  billing_plugin_variants: [
    {
      plugin_key: 'eva_video_special',
      plugin_name: 'Special video line',
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", u("seconds") * 0.242)',
      billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
    },
    {
      plugin_key: 'eva_video_stable',
      plugin_name: 'Stable video line',
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", u("seconds") * 0.44)',
      billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
    },
  ],
}

async function renderGroupPricing(group: string, pricing: PricingModel = videoGroupPricing) {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const routeQuote: Quote = {
    ...quote,
    group,
    currency: 'USD',
    billing_expr: 'tier("base", u("seconds") * 8.88)',
    components: [{ kind: 'request', amount: '7.77', quantity: 1, unit: 'request' }],
    legacy_components: [{ kind: 'request', amount: '6.66', quantity: 1, unit: 'request' }],
  }
  return renderToStaticMarkup(
    createElement(I18nextProvider, { i18n, children: createElement(PriceBreakdown, { quote: routeQuote, pricing, groupRatio: 1 }) })
  )
}

describe('video group provider prices', () => {
  it.each([
    ['video-special', 'Special video line', '$0.242', 'Stable video line', '$0.44'],
    ['video-stable', 'Stable video line', '$0.44', 'Special video line', '$0.242'],
  ])('shows only the executing provider price for %s', async (group, provider, amount, otherProvider, otherAmount) => {
    const html = await renderGroupPricing(group)
    expect(html).toContain(provider)
    expect(html).toContain(amount)
    expect(html).not.toContain(otherProvider)
    expect(html).not.toContain(otherAmount)
    for (const unrelatedAmount of ['$9.99', '$8.88', '$7.77', '$6.66']) expect(html).not.toContain(unrelatedAmount)
  })
  it.each(['missing', 'unconfigured'])('does not substitute another group or legacy price when the selected provider is %s', async (condition) => {
    const variants = videoGroupPricing
      .billing_plugin_variants!.filter((variant) => condition !== 'missing' || variant.plugin_key !== 'eva_video_stable')
      .map((variant) => (variant.plugin_key === 'eva_video_stable' ? { ...variant, billing_expr: '', billing_mode: 'ratio' as const } : variant))
    const html = await renderGroupPricing('video-stable', { ...videoGroupPricing, billing_plugin_variants: variants })
    expect(html).toContain('Unconfigured')
    expect(html).not.toContain('Special video line')
    for (const amount of ['$0.242', '$9.99', '$8.88', '$7.77', '$6.66']) expect(html).not.toContain(amount)
  })
  it('preserves other models and groups without the explicit video group policy', async () => {
    const unrelated = {
      ...videoGroupPricing,
      model_name: 'other-model',
      billing_plugin_variants: videoGroupPricing.billing_plugin_variants!.map((variant, index) => ({
        ...variant,
        plugin_key: `other-provider-${index}`,
      })),
    }
    const otherModel = await renderGroupPricing('video-special', unrelated)
    const otherGroup = await renderGroupPricing('vip')
    for (const html of [otherModel, otherGroup]) {
      expect(html).toContain('Special video line')
      expect(html).toContain('Stable video line')
      expect(html).toContain('$9.99')
      expect(html).toContain('$7.77')
    }
  })
})

describe('group-scoped pricing', () => {
  it('shows the channel token tiers without using the plugin default', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const channelQuote: Quote = {
      ...quote,
      status: 'dynamic',
      pricing_source: 'channel',
      billing_expr: 'u("video_input") == "video" ? tier("video", u("tokens") * 1.6 / 1000000) : tier("base", u("tokens") * 2.4 / 1000000)',
      billing_usage_schema: { video_input: { enum: ['video', 'none'] }, tokens: { type: 'number', unit: 'token' } },
    }
    const summary = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: channelQuote, groupRatio: 1, exchangeRate: 7 }) })
    )
    const detail = renderToStaticMarkup(
      createElement(I18nextProvider, {
        i18n,
        children: createElement(PriceBreakdown, { quote: channelQuote, pricing: videoGroupPricing, groupRatio: 1, exchangeRate: 7 }),
      })
    )
    expect(summary).toContain('¥11.2')
    expect(summary).toContain('Lowest price')
    expect(detail).toContain('¥11.2')
    expect(detail).toContain('¥16.8')
    expect(detail).not.toContain('9.99')
  })
  it('shows the actual per-image price for an image-count expression', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const scoped: Quote = { ...quote, status: 'dynamic', billing_group_scoped: true, billing_expr: 'tier("image", fixed(0.01)) * image_count' }
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: scoped, groupRatio: 1, exchangeRate: 8 }) })
    )
    expect(html).toContain('¥0.08')
    expect(html).toContain('Per image')
  })
  it('shows input and output prices with their unit for an ordinary scoped expression', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const scoped: Quote = { ...quote, status: 'dynamic', billing_group_scoped: true, billing_expr: 'tier("base", p * 2 + c * 5 + cr * 0.1)' }
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: scoped, groupRatio: 0.5, exchangeRate: 7 }) })
    )
    expect(html).toContain('¥7')
    expect(html).toContain('¥17.5')
    expect(html).toContain('Per million tokens')
  })
  it('labels a multi-tier price as the lowest price', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const scoped: Quote = {
      ...quote,
      currency: 'USD',
      status: 'dynamic',
      billing_group_scoped: true,
      billing_expr: 'len <= 200000 ? tier("base", p * 1 + c * 5) : tier("long", p * 2 + c * 10)',
    }
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: scoped, groupRatio: 1 }) })
    )
    expect(html).toContain('$1')
    expect(html).toContain('$5')
    expect(html).toContain('Lowest price')
  })
  it('does not invent a price when the group multiplier is missing', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const scoped: Quote = { ...quote, currency: 'USD', status: 'dynamic', billing_group_scoped: true, billing_expr: 'tier("base", p * 2 + c * 5)' }
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: scoped }) }))
    expect(html).toContain('Dynamic pricing')
    expect(html).not.toContain('$2')
  })
  it('shows the input, output and reference rates for a simple source route', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const sourceQuote: Quote = {
      ...quote,
      currency: 'USD',
      group: 'dddai-claude-kiro',
      status: 'dynamic',
      billing_group_scoped: true,
      billing_expr: 'tier("base", p * 5 + c * 25)',
    }
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: sourceQuote, groupRatio: 0.25 }) })
    )
    for (const amount of ['$1.25', '$6.25', '$5', '$25']) expect(html).toContain(amount)
    expect(html).toContain('Base prices before group ratio')
    expect(html).toContain('Per million tokens')
  })
  it('converts source route and reference prices to the selected currency', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const sourceQuote: Quote = {
      ...quote,
      currency: 'CNY',
      group: 'dddai-claude-kiro',
      status: 'dynamic',
      billing_group_scoped: true,
      billing_expr: 'tier("base", p * 4 + c * 8)',
    }
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: sourceQuote, groupRatio: 0.25, exchangeRate: 7.3 }) })
    )
    for (const amount of ['7.3', '14.6', '29.2', '58.4']) expect(html).toContain(amount)
  })
  it('shows the standard context tier and its reference price for a source route', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const sourceQuote: Quote = {
      ...quote,
      currency: 'USD',
      group: 'dddai-codex-plus',
      status: 'dynamic',
      billing_group_scoped: true,
      billing_expr: '(len <= 272000 ? tier("standard", p * 10 + c * 50) : tier("long", p * 20 + c * 75)) * (param("service_tier") == "fast" ? 2 : 1)',
    }
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: sourceQuote, groupRatio: 0.15 }) })
    )
    for (const amount of ['$1.5', '$7.5', '$10', '$50']) expect(html).toContain(amount)
  })
  it('does not present a base price as the route price while the source group ratio is unavailable', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const sourceQuote: Quote = {
      ...quote,
      currency: 'USD',
      group: 'dddai-codex-plus',
      status: 'dynamic',
      billing_group_scoped: true,
      billing_expr: 'tier("base", p * 10 + c * 50)',
    }
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n, children: createElement(PriceBreakdown, { quote: sourceQuote }) }))
    expect(html).toContain('Unavailable')
    expect(html).not.toContain('$10')
  })
  async function renderScoped(group: string, expression: string, status = 'dynamic') {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const routeQuote = {
      ...quote,
      currency: 'USD' as const,
      group,
      status,
      billing_group_scoped: true,
      billing_expr: expression,
      components: [{ kind: 'request', amount: '7.77', quantity: 1, unit: 'request' }],
      legacy_components: [{ kind: 'request', amount: '6.66', quantity: 1, unit: 'request' }],
    }
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, {
        i18n,
        children: createElement(PriceBreakdown, { quote: routeQuote, pricing: videoGroupPricing, groupRatio: 0.5 }),
      })
    )
    return { html, routeQuote }
  }
  it.each([
    ['video-special', 'tier("base", p * 2 + c * 4)', '$1', '$2'],
    ['video-stable', 'tier("base", p * 6 + c * 8)', '$3', '$4'],
  ])('uses only the selected %s expression for details and estimates', async (group, expression, input, output) => {
    const { html } = await renderScoped(group, expression)
    expect(html).toContain(input)
    expect(html).toContain(output)
    expect(html).toContain(expression.replaceAll('"', '&quot;'))
    expect(html).toContain('Price estimate')
    for (const other of ['$9.99', '$7.77', '$6.66', '$0.242', '$0.44', 'Special video line', 'Stable video line']) expect(html).not.toContain(other)
  })
  it.each(['unconfigured', 'dynamic'])('does not fall back when a scoped %s quote has no expression', async (status) => {
    const { html, routeQuote } = await renderScoped('video-stable', '', status)
    expect(html).toContain('Unconfigured')
    expect(html).not.toContain('Price estimate')
    for (const other of ['$9.99', '$7.77', '$6.66', '$0.242', '$0.44']) expect(html).not.toContain(other)
    expect(quoteUnitLabel(routeQuote)).toBe('Unconfigured')
  })
  it('treats an explicitly unconfigured quote as unavailable even with a stale expression', async () => {
    const { html, routeQuote } = await renderScoped('video-stable', 'tier("base", p * 9 + c * 10)', 'unconfigured')
    expect(html).toContain('Unconfigured')
    expect(html).not.toContain('Price estimate')
    expect(html).not.toContain('$4.5')
    expect(quoteUnitLabel(routeQuote)).toBe('Unconfigured')
  })
  it('does not show stale components in a scoped summary', async () => {
    const { routeQuote } = await renderScoped('video-special', 'tier("base", p * 2 + c * 4)')
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n, children: createElement(PriceDisplay, { quote: routeQuote }) }))
    expect(html).not.toContain('7.77')
    expect(quoteUnitLabel(routeQuote)).toBe('See price details')
  })
})

describe('catalog price units', () => {
  it('does not label dynamic pricing as a token price', () => {
    expect(quoteUnitLabel(quote)).toBe('See price details')
  })
  it('distinguishes a free request price from per-million token prices', () => {
    expect(quoteUnitLabel({ ...quote, components: [{ kind: 'request', amount: '0', quantity: 1, unit: 'request' }] })).toBe('Per request')
    expect(quoteUnitLabel({ ...quote, components: [{ kind: 'input', amount: '2', quantity: 1000000, unit: 'token' }] })).toBe('Per million tokens')
  })
  it('keeps a small nonzero quote visible and does not exchange a converted amount twice', () => {
    expect(formatPrice(0.00000001, 'USD', 'en-US')).toBe('$0.00000001')
    expect(formatPrice(7, 'CNY', 'en-US')).toBe('¥7')
  })
  it('shows a useful fallback when a quote has no summary price component', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, {
        i18n,
        children: createElement(PriceDisplay, {
          quote: { ...quote, components: [{ kind: 'cache_read', amount: '0.5', quantity: 1000000, unit: 'token' }] },
        }),
      })
    )
    expect(html).toContain('See price details')
  })
  it('shows the per-request unit and explicit free price in public route details', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, {
        i18n,
        children: createElement(PriceBreakdown, { quote: { ...quote, currency: 'USD', billing_expr: 'tier("request", fixed(0))' }, groupRatio: 0.5 }),
      })
    )
    expect(html).toContain('Per request')
    expect(html).toContain('$0')
    expect(html).not.toContain('Per million tokens')
  })
  it('shows task token prices per million and keeps incompatible schema expressions raw', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const pricing: PricingModel = {
      id: 1,
      model_name: 'fixture',
      quota_type: 0,
      model_ratio: 0,
      completion_ratio: 0,
      enable_groups: ['default'],
      billing_expr: 'tier("base", u("tokens") * 10 / 1000000)',
      billing_usage_schema: { tokens: { type: 'number', unit: 'token' } },
    }
    const render = (value: PricingModel) =>
      renderToStaticMarkup(
        createElement(I18nextProvider, {
          i18n,
          children: createElement(PriceBreakdown, { quote: { ...quote, currency: 'USD' }, pricing: value, groupRatio: 0.5 }),
        })
      )
    expect(render(pricing)).toContain('$5')
    expect(render(pricing)).toContain('Per million tokens')
    expect(render({ ...pricing, billing_usage_schema: {} })).not.toContain('$5')
  })
  it('labels template video prices per second or per video and preserves real fixed charges', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'zh', resources: { zh: { translation: chinese } } })
    const pricing: PricingModel = {
      id: 1,
      model_name: 'seedance-2-0-special-720p-second',
      quota_type: 0,
      model_ratio: 0,
      completion_ratio: 0,
      enable_groups: ['default'],
      billing_expr: 'tier("base", u("seconds") * 0.2)',
      billing_usage_schema: { seconds: { type: 'number', unit: 'second' }, videos: { type: 'number', unit: 'count' } },
    }
    const render = (value: PricingModel) =>
      renderToStaticMarkup(
        createElement(I18nextProvider, {
          i18n,
          children: createElement(PriceBreakdown, { quote: { ...quote, currency: 'USD' }, pricing: value, groupRatio: 1 }),
        })
      )
    const seconds = render(pricing)
    expect(seconds).toContain('每秒')
    expect(seconds).toContain('$0.2')
    expect(seconds).not.toContain('seconds · second')
    const video = render({ ...pricing, model_name: 'wan3-standard-all-video', billing_expr: 'tier("base", u("videos") * 1.8)' })
    expect(video).toContain('固定（每条）')
    expect(video).toContain('$1.8')
    expect(video).not.toContain('videos · count')
    expect(video).not.toContain('<dt>固定价格</dt>')
    const extra = render({ ...pricing, model_name: 'wan3-standard-all-video', billing_expr: 'tier("base", 0.5 + u("videos") * 1.8)' })
    expect(extra).toContain('<dt>固定价格</dt>')
    expect(extra).toContain('$0.5')
  })
  it('keeps generic count usage as a count rather than claiming a fixed video price', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const pricing: PricingModel = {
      id: 2,
      model_name: 'unrelated-video',
      quota_type: 0,
      model_ratio: 0,
      completion_ratio: 0,
      enable_groups: ['default'],
      billing_expr: 'tier("base", u("videos") * 1.8)',
      billing_usage_schema: { seconds: { type: 'number', unit: 'second' }, videos: { type: 'number', unit: 'count' } },
    }
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n, children: createElement(PriceBreakdown, { quote: { ...quote, currency: 'USD' }, pricing }) })
    )
    expect(html).toContain('videos · count')
    expect(html).not.toContain('Fixed (per video)')
  })
})

import {
  readCatalogFilters,
  catalogFilterQuery,
  catalogOfferings,
  catalogQuote,
  connectRoute,
  filterCatalog,
  toggleCatalogComparison,
} from '../catalog-state'
import { modelHref } from '../model-card'
import type { CatalogModel } from '@/lib/api/types'
import { SuccessHistory } from '@/features/performance/success-history'
import { applicableNotices } from '../notice-state'
const catalogModel = (id: string, provider: string, groups: string[], amount?: string): CatalogModel => ({
  model_key: id,
  configured_model_id: id,
  name: id,
  provider,
  description: '',
  modality: 'text',
  icon: '',
  context_window: null,
  max_output_tokens: null,
  offerings: groups.map((group) => ({
    offering_key: group,
    name: group,
    invocation_id: id,
    public_description: '',
    availability: 'available',
    prices: [],
    metrics: [],
    access: [],
  })),
  offerings_count: groups.length,
  price_summary:
    amount === undefined
      ? []
      : [{ offering_key: groups[0], quote: { ...quote, components: [{ kind: 'input', amount, quantity: 1000000, unit: 'token' }] } }],
  metrics: [],
  capabilities: ['tools'],
  input_modalities: ['text'],
  output_modalities: ['text'],
})

it('filters by input modality together with a selected group', () => {
  const text = catalogModel('text-model', 'OpenAI', ['standard'])
  const image = { ...catalogModel('image-model', 'OpenAI', ['standard']), input_modalities: ['image'] }
  const otherGroup = { ...catalogModel('other-group', 'OpenAI', ['other']), input_modalities: ['image'] }
  const filters = readCatalogFilters('input=image&group=standard')
  expect(filterCatalog([text, image, otherGroup], filters).map((model) => model.name)).toEqual(['image-model'])
  expect(readCatalogFilters(catalogFilterQuery('input=image&group=standard', 'input', [])).inputs).toEqual([])
})
describe('public catalog filters and observed performance', () => {
  const models = [
    catalogModel('alpha', 'OpenAI', ['default'], '0'),
    catalogModel('beta', 'Anthropic', ['vip'], '2'),
    catalogModel('gamma', 'Google', ['default', 'vip']),
  ]
  it('preserves repeated facets and reads a shared URL without duplicating state', () => {
    const filters = readCatalogFilters('provider=OpenAI&provider=Google&provider=OpenAI&group=vip&currency=USD&page=2')
    expect(filters.providers).toEqual(['OpenAI', 'Google'])
    expect(filters.page).toBe(2)
    expect(filters.currency).toBe('CNY')
    expect(filterCatalog(models, filters).map((model) => model.name)).toEqual(['gamma'])
  })
  it('changes or clears the provider filter and ignores legacy USD links', () => {
    const query = 'provider=OpenAI&currency=USD&page=2'
    expect(filterCatalog(models, readCatalogFilters(query)).map((model) => model.name)).toEqual(['alpha'])
    const changed = catalogFilterQuery(query, 'provider', ['Google'])
    expect(readCatalogFilters(changed)).toMatchObject({ providers: ['Google'], currency: 'CNY', page: 1 })
    expect(readCatalogFilters(catalogFilterQuery(query, 'provider', [])).providers).toEqual([])
    const unknown = [catalogModel('unassigned', '', ['default']), catalogModel('named', 'Unknown', ['default'])]
    expect(filterCatalog(unknown, readCatalogFilters('provider=Unknown&provider=__unknown__')).map((model) => model.name)).toEqual([
      'named',
      'unassigned',
    ])
  })
  it('ORs choices within a facet, ANDs different facets and matches all query terms', () => {
    expect(
      filterCatalog(models, readCatalogFilters('q=alpha+tools&provider=OpenAI&provider=Anthropic&group=default')).map((model) => model.name)
    ).toEqual(['alpha'])
    expect(filterCatalog(models, readCatalogFilters('q=alpha+vip'))).toEqual([])
    expect(filterCatalog(models, readCatalogFilters('modality=image'))).toEqual([])
    const unknown = catalogModel('unassigned', '', ['default'])
    expect(filterCatalog([...models, unknown], readCatalogFilters('provider=__unknown__')).map((model) => model.name)).toEqual(['unassigned'])
  })
  it('resets pagination and removes the legacy currency when replacing the facet list', () => {
    const query = catalogFilterQuery('currency=USD&page=3&provider=OpenAI&provider=Google', 'provider', ['Anthropic', 'Google'])
    expect(readCatalogFilters(query)).toMatchObject({ providers: ['Anthropic', 'Google'], page: 1, currency: 'CNY' })
    expect(new URLSearchParams(catalogFilterQuery(query, 'page', '2')).get('page')).toBe('2')
    expect(new URLSearchParams(catalogFilterQuery(query, 'modality', 'all')).has('modality')).toBe(false)
  })
  it('keeps all as a search term or a real facet value', () => {
    const query = catalogFilterQuery('currency=USD', 'q', 'all')
    expect(readCatalogFilters(query).q).toBe('all')
    expect(readCatalogFilters(catalogFilterQuery(query, 'group', ['all'])).groups).toEqual(['all'])
    expect(readCatalogFilters(catalogFilterQuery(query, 'provider', ['all'])).providers).toEqual(['all'])
    expect(new URLSearchParams(catalogFilterQuery(query, 'modality', 'all')).has('modality')).toBe(false)
  })
  it('drops models no longer visible before applying the comparison limit', () => {
    const current = [...models, catalogModel('delta', 'OpenAI', ['vip'])]
    expect(toggleCatalogComparison(['missing-1', 'missing-2', 'alpha', 'beta'], 'gamma', current)).toEqual(['alpha', 'beta', 'gamma'])
    expect(toggleCatalogComparison(['alpha', 'beta', 'gamma', 'delta'], 'gamma', current)).toEqual(['alpha', 'beta', 'delta'])
    expect(toggleCatalogComparison(['alpha', 'beta', 'gamma', 'delta'], 'new', current)).toBeNull()
  })
  it('treats zero as measured data, places missing samples last, and keeps free prices first', () => {
    const metrics = new Map([
      ['alpha', { avg_latency_ms: 0, success_rate: 0, avg_tps: 0 }],
      ['gamma', { avg_latency_ms: 50, success_rate: 90, avg_tps: 25 }],
    ])
    expect(filterCatalog(models, readCatalogFilters('sort=success'), metrics).map((model) => model.name)).toEqual(['gamma', 'alpha', 'beta'])
    expect(filterCatalog(models, readCatalogFilters('sort=speed'), metrics).map((model) => model.name)).toEqual(['gamma', 'alpha', 'beta'])
    expect(filterCatalog(models, readCatalogFilters('sort=price')).map((model) => model.name)).toEqual(['alpha', 'beta', 'gamma'])
  })
  it('places models without throughput samples after measured zero values', () => {
    const metrics = new Map([
      ['alpha', { avg_latency_ms: 10, success_rate: 100, avg_tps: 0, has_tps: false }],
      ['beta', { avg_latency_ms: 10, success_rate: 100, avg_tps: 0, has_tps: true }],
    ])
    expect(filterCatalog(models, readCatalogFilters('sort=speed'), metrics).map((model) => model.name)).toEqual(['beta', 'alpha', 'gamma'])
  })
  it('sorts known context windows from largest to smallest and puts missing values last', () => {
    const rows = models.map((item, index) => ({ ...item, context_window: [0, null, 128000][index] }))
    expect(filterCatalog(rows, readCatalogFilters('sort=context')).map((item) => item.name)).toEqual(['gamma', 'alpha', 'beta'])
  })
  it('uses the selected group quote for display and sorting', () => {
    const shared = catalogModel('shared', 'OpenAI', ['default', 'vip'], '1')
    shared.price_summary.push({
      offering_key: 'vip',
      quote: {
        ...quote,
        group: 'vip',
        components: [
          { kind: 'cache_read', amount: '0.01', quantity: 1000000, unit: 'token' },
          { kind: 'input', amount: '9', quantity: 1000000, unit: 'token' },
        ],
      },
    })
    const other = catalogModel('other', 'Google', ['vip'], '3')
    const filters = readCatalogFilters('group=vip&sort=price')
    expect(catalogQuote(shared, filters.groups)?.group).toBe('vip')
    expect(filterCatalog([shared, other], filters).map((item) => item.name)).toEqual(['other', 'shared'])
    expect(catalogQuote(shared, ['missing'])).toBeUndefined()
  })
  it('keeps the underlying group ID when filtering and linking a named route', () => {
    const shared = catalogModel('shared', 'OpenAI', ['xlsx-g-123'], '1')
    shared.offerings[0].public_description = 'Supplier route'
    const filters = readCatalogFilters('group=xlsx-g-123')
    expect(filterCatalog([shared], filters)).toEqual([shared])
    expect(catalogOfferings(shared, filters.groups)[0].name).toBe('xlsx-g-123')
    expect(new URL(modelHref(shared, filters.groups), 'https://eva.test').searchParams.get('group')).toBe('xlsx-g-123')
  })
  it('chooses a configured scoped route while preserving an explicitly selected unconfigured group', () => {
    const shared = catalogModel('shared', 'OpenAI', ['special', 'stable'])
    shared.price_summary = [
      { offering_key: 'special', quote: { ...quote, group: 'special', billing_group_scoped: true, status: 'unconfigured', billing_expr: '' } },
      {
        offering_key: 'stable',
        quote: { ...quote, group: 'stable', billing_group_scoped: true, status: 'dynamic', billing_expr: 'tier("base", p * 2 + c * 4)' },
      },
    ]
    expect(catalogQuote(shared, [])?.group).toBe('stable')
    expect(catalogQuote(shared, ['special'])?.status).toBe('unconfigured')
    expect(new URL(modelHref(shared), 'https://eva.test').searchParams.get('group')).toBe('stable')
  })
  it('chooses a comparable lower route and links to the same group', () => {
    const shared = catalogModel('shared', 'OpenAI', ['default', 'vip'], '4')
    shared.price_summary.push({
      offering_key: 'vip',
      quote: { ...quote, group: 'vip', components: [{ kind: 'input', amount: '1', quantity: 1000000, unit: 'token' }] },
    })
    expect(catalogQuote(shared, [])?.group).toBe('vip')
    expect(new URL(modelHref(shared), 'https://eva.test').searchParams.get('group')).toBe('vip')
    expect(new URL(modelHref(shared, [], 'USD'), 'https://eva.test').searchParams.get('currency')).toBe('USD')
    expect(catalogQuote(shared, ['default'])?.group).toBe('default')
    shared.price_summary[1].quote.components[0].unit = 'request'
    expect(catalogQuote(shared, [])?.group).toBe('default')
  })
  it('does not claim a winner when fixed components cross or a route is dynamic', () => {
    const shared = catalogModel('shared', 'OpenAI', ['default', 'vip'], '1')
    shared.price_summary[0].quote.components.push({ kind: 'output', amount: '4', quantity: 1000000, unit: 'token' })
    shared.price_summary.push({
      offering_key: 'vip',
      quote: {
        ...quote,
        group: 'vip',
        components: [
          { kind: 'input', amount: '2', quantity: 1000000, unit: 'token' },
          { kind: 'output', amount: '1', quantity: 1000000, unit: 'token' },
        ],
      },
    })
    expect(catalogQuote(shared, [])?.group).toBe('default')
    shared.price_summary[1].quote.status = 'dynamic'
    expect(catalogQuote(shared, [])?.group).toBe('default')
  })
  it('sorts prices only within the same billing basis and keeps unavailable quotes last', () => {
    const tokenLow = catalogModel('token-low', 'OpenAI', ['default'], '2')
    const tokenHigh = catalogModel('token-high', 'OpenAI', ['default'], '9')
    const requestLow = catalogModel('request-low', 'OpenAI', ['default'], '0.01')
    requestLow.price_summary[0].quote.components = [{ kind: 'request', amount: '0.01', quantity: 1, unit: 'request' }]
    const requestHigh = catalogModel('request-high', 'OpenAI', ['default'], '3')
    requestHigh.price_summary[0].quote.components = [{ kind: 'request', amount: '3', quantity: 1, unit: 'request' }]
    const unknown = catalogModel('unknown', 'OpenAI', ['default'])
    expect(filterCatalog([tokenHigh, requestHigh, unknown, tokenLow, requestLow], readCatalogFilters('sort=price')).map((item) => item.name)).toEqual(
      ['token-low', 'token-high', 'request-low', 'request-high', 'unknown']
    )
  })
  it('projects route counts and detail links onto selected groups', () => {
    const shared = catalogModel('model /1', 'OpenAI', ['default', 'vip'])
    expect(catalogOfferings(shared, [])).toHaveLength(2)
    expect(catalogOfferings(shared, ['vip']).map((route) => route.name)).toEqual(['vip'])
    expect(catalogOfferings(shared, ['missing'])).toHaveLength(0)
    const link = new URL(modelHref(shared, ['vip']), 'https://eva.test')
    expect(link.searchParams.get('catalogKey')).toBe('model /1')
    expect(link.searchParams.get('group')).toBe('vip')
    expect(new URL(modelHref(shared, []), 'https://eva.test').searchParams.has('group')).toBe(false)
  })
  it('keeps the selected scoped group while refusing an unconfigured route', () => {
    const shared = catalogModel('same-model', 'OpenAI', ['special', 'stable'])
    shared.offerings[0].prices = [
      { ...quote, group: 'special', status: 'dynamic', billing_group_scoped: true, billing_expr: 'tier("base", p * 2 + c * 4)' },
    ]
    shared.offerings[1].prices = [{ ...quote, group: 'stable', status: 'unconfigured', billing_group_scoped: true, billing_expr: '' }]
    shared.offerings[1].availability = 'unavailable'
    expect(catalogOfferings(shared, ['stable']).map((route) => route.name)).toEqual(['stable'])
    expect(connectRoute(shared, 'special')?.name).toBe('special')
    expect(connectRoute(shared, 'stable')).toBeUndefined()
    expect(connectRoute(shared, 'special', 'stable')).toBeUndefined()
  })
  it('shows global notices and notices matching both the model and an available route', () => {
    const notices = [
      { public_message: 'Global' },
      { public_message: 'Matching', models: ['alpha'], groups: ['default'], offering_keys: ['default'] },
      { public_message: 'Different model', models: ['beta'], groups: ['default'] },
      { public_message: 'Different route', models: ['alpha'], groups: ['vip'] },
      { public_message: 'Different offering', models: ['alpha'], groups: ['default'], offering_keys: ['vip'] },
    ]
    expect(applicableNotices(notices, [models[0]]).map((item) => item.public_message)).toEqual(['Global', 'Matching'])
    expect(applicableNotices(notices, []).map((item) => item.public_message)).toEqual(['Global'])
    const multi = { ...models[0], offerings: [...models[0].offerings, ...models[1].offerings] }
    expect(applicableNotices(notices, [multi], ['vip']).map((item) => item.public_message)).toEqual(['Global', 'Different route'])
  })
  it('does not invent hourly samples and exposes a zero-success sample to keyboards', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const render = (points: { ts: number; success_rate: number }[]) =>
      renderToStaticMarkup(createElement(I18nextProvider, { i18n, children: createElement(SuccessHistory, { points }) }))
    expect(render([])).toBe('')
    const html = render([
      { ts: 1700000000, success_rate: 0 },
      { ts: 1700003600, success_rate: 100 },
    ])
    expect(html.match(/role="img"/g)).toHaveLength(2)
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('0%')
    expect(html).toContain('var(--success) 0%')
  })
})

it('shows the bound plugin unit price without unrelated model variants', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const bound: Quote = { ...quote, pricing_source: 'plugin', components: [{ kind: 'request', amount: '0.4725', quantity: 1, unit: 'second' }] }
  const html = renderToStaticMarkup(
    createElement(I18nextProvider, { i18n }, createElement(PriceBreakdown, { quote: bound, pricing: videoGroupPricing, exchangeRate: 7.3 }))
  )
  expect(html).toContain('0.4725')
  expect(html).toContain('Per second')
  expect(html).not.toContain('eva_video_special')
  expect(html).not.toContain('eva_video_stable')
  expect(html).not.toContain('Per million tokens')
})

it('labels a bound per-video quote as fixed per video', () => {
  const bound: Quote = { ...quote, pricing_source: 'plugin', components: [{ kind: 'request', amount: '4.2', quantity: 1, unit: 'request' }] }
  expect(quoteUnitLabel(bound)).toBe('Fixed (per video)')
})

it('matches Chinese vendor and modality aliases when filtering the catalog', () => {
  const qwen = catalogModel('qwen3-max', 'Alibaba', ['default'], '2')
  const claude = catalogModel('claude-sonnet-4', 'Anthropic', ['default'], '3')
  const seedance = { ...catalogModel('seedance-2-0', 'ByteDance', ['default'], '1'), modality: 'video' }
  const imageGen = { ...catalogModel('flux-pro', 'Black Forest', ['default'], '0.5'), modality: 'image' }
  const list = [qwen, claude, seedance, imageGen]

  expect(filterCatalog(list, readCatalogFilters('q=千问')).map((m) => m.configured_model_id)).toEqual(['qwen3-max'])
  expect(filterCatalog(list, readCatalogFilters('q=千问3')).map((m) => m.configured_model_id)).toEqual(['qwen3-max'])
  expect(filterCatalog(list, readCatalogFilters('q=克劳德')).map((m) => m.configured_model_id)).toEqual(['claude-sonnet-4'])
  expect(filterCatalog(list, readCatalogFilters('q=即梦')).map((m) => m.configured_model_id)).toEqual(['seedance-2-0'])
  expect(filterCatalog(list, readCatalogFilters('q=画图')).map((m) => m.configured_model_id)).toEqual(['flux-pro'])
  expect(filterCatalog(list, readCatalogFilters('q=视频')).map((m) => m.configured_model_id)).toEqual(['seedance-2-0'])
})

it.each(['inline', 'columns'] as const)('labels ordinary Input and Output prices with the %s layout', async (layout) => {
  const i18n = createInstance()
  await i18n.init({ lng: 'zh', resources: { zh: { translation: chinese } } })
  const fixedQuote: Quote = {
    ...quote,
    components: [
      { kind: 'input', amount: '1.5', quantity: 1000000, unit: 'token' },
      { kind: 'output', amount: '6', quantity: 1000000, unit: 'token' },
    ],
  }
  const html = renderToStaticMarkup(
    createElement(I18nextProvider, { i18n }, createElement(PriceDisplay, { quote: fixedQuote, layout, showUnit: layout === 'inline' }))
  )
  if (layout === 'columns') expect(html).toContain('grid-cols-[auto_1fr]')
  else expect(html).toContain(chinese['Per million tokens'])
  const withoutUnit = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(PriceDisplay, { quote: fixedQuote })))
  expect(withoutUnit).not.toContain(chinese['Per million tokens'])
  expect(html).toContain('输入')
  expect(html).toContain('输出')
  expect(html).toContain('¥1.5')
  expect(html).toContain('¥6')
})
