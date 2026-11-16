import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { AnalyticsPanel } from '../analytics-panel'
import { MetricTrend } from '@/components/shared/metric-trend'
import { TrafficFlow } from '../traffic-flow'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1 } } }) }))

it('identifies disabled collection while retaining the historical analytics panel', async () => {
  const client = new QueryClient()
  client.setQueryData(['status'], { enable_data_export: false, quota_per_unit: 500000 })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <AnalyticsPanel />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('Data Dashboard')
  expect(html).toContain('Disabled')
  expect(html).toContain('Usage analytics')
})

it('keeps a single tab stop for charts with many time points', () => {
  const points = Array.from({ length: 48 }, (_, index) => ({ key: String(index), timestamp: index, value: index }))
  const html = renderToStaticMarkup(
    <MetricTrend points={points} format={String} date={String} title="Trend" selectionLabel="Trend" controlsLabel="Trend" />
  )
  expect(html.match(/tabindex="0"/g)).toHaveLength(1)
  expect(html.match(/tabindex="-1"/g)).toHaveLength(47)
})

it('leaves gaps between observed trend segments and labels missing samples', () => {
  const points = [
    { key: 'a', timestamp: 1, value: 0 },
    { key: 'b', timestamp: 2, value: null },
    { key: 'c', timestamp: 3, value: 10 },
  ]
  const html = renderToStaticMarkup(
    <MetricTrend
      points={points}
      format={String}
      date={String}
      title="Trend"
      selectionLabel="Trend"
      controlsLabel="Trend"
      missingLabel="No measurements"
    />
  )
  expect(html.match(/<polyline/g)).toHaveLength(2)
  expect(html).toContain('aria-label="2: No measurements"')
  expect(html).toContain('aria-label="1: 0"')
})

it('keeps one tab stop for the flow graph while exposing its nodes and links', async () => {
  const client = new QueryClient()
  client.setQueryData(['status'], { quota_per_unit: 500000 })
  client.setQueryData(
    ['traffic-flow', 1, 'user', 100, 200, ''],
    [{ token_id: 1, token_name: 'key', use_group: 'group', model_name: 'model', quota: 10, count: 1, token_used: 5 }]
  )
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <TrafficFlow userId={1} role="user" start={100} end={200} username="" initialOpen />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const svg = html.match(/<svg[\s\S]*?<\/svg>/)?.[0] || ''
  expect(svg.match(/role="button"/g)).toHaveLength(5)
  expect(svg.match(/tabindex="0"/g)).toHaveLength(1)
  expect(svg.match(/tabindex="-1"/g)).toHaveLength(4)
})
