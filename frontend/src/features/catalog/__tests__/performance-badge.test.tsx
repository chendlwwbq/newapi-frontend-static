import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { CatalogPerformanceBadge } from '../performance-badge'

it('shows the observed 24-hour success rate, including zero', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const render = (rate: number | null) =>
    renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <CatalogPerformanceBadge successRate={rate} />
      </I18nextProvider>
    )
  expect(render(95.5)).toContain('95.5%')
  expect(render(0)).toContain('0%')
  expect(render(null)).toBe('')
  const filtered = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <CatalogPerformanceBadge successRate={95} filtered />
    </I18nextProvider>
  )
  expect(filtered).toContain('Last 24 hours across selected groups.')
  expect(render(95)).toContain('Last 24 hours across all active groups.')
})
