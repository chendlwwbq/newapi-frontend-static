import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { SettingsCollectionEditor } from './settings-collection-editor'

it('previews console content with the same components as the dashboard', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const render = (optionKey: string, row: object) =>
    renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <SettingsCollectionEditor id="example" optionKey={optionKey} value={JSON.stringify([row])} onChange={() => {}} />
      </I18nextProvider>
    )
  const announcement = render('console_setting.announcements', { id: 1, content: 'Notice text', publishDate: 'invalid draft', type: 'default' })
  expect(announcement).toContain('invalid draft')
  expect(announcement).toContain('<article><p>Notice text</p>')
  const faq = render('console_setting.faq', { id: 1, question: 'Question text', answer: 'Answer text' })
  expect(faq).toContain('<details><summary>Question text</summary><p>Answer text</p></details>')
  const api = render('console_setting.api_info', { id: 1, description: 'API text', route: 'main', url: 'https://example.test', color: 'blue' })
  expect(api).toContain('<code class="admin-models">https://example.test</code>')
  expect(api).toContain('type="button"')
})
