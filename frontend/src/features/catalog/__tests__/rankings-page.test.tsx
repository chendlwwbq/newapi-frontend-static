import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { RankingsPage } from '../rankings-page'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle: null }) }))
vi.mock('../rankings-history-chart', () => ({ RankingsHistoryChart: () => null }))
vi.mock('../model-card', () => ({ ProviderIcon: () => null }))
vi.mock('@/components/motion/reveal', () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }))

it('links ranking providers and preserves the current rank for rising and falling models', async () => {
  const client = new QueryClient()
  client.setQueryData(['rankings', 'week', 0], {
    models: [{ rank: 1, model_name: 'model/a', vendor: 'A & B', total_tokens: 10, share: 1, growth_pct: 10 }],
    vendors: [{ vendor: 'A & B', total_tokens: 10, share: 1, models_count: 1 }],
    top_movers: [{ model_name: 'model/a', vendor: 'A & B', current_rank: 1250, rank_delta: 2 }],
    top_droppers: [{ model_name: 'model/b', vendor: 'Unknown', current_rank: 3, rank_delta: -1 }],
    models_history: {},
    vendor_share_history: {},
  })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RankingsPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(html).toContain('href="/pricing?provider=A+%26+B"')
  expect(html).toContain('href="/pricing?provider=Unknown&amp;provider=__unknown__"')
  expect(html).toContain('#1,250')
  expect(html).toContain('#3')
  expect(html).toContain('href="/pricing/model%2Fa"')
})
