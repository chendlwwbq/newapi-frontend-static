import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { PdfAttachment } from '../pdf-attachment'

it('offers the saved PDF for download and rejects unsafe links', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const render = (data: string) =>
    renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <PdfAttachment file={{ name: 'report.pdf', data }} />
      </I18nextProvider>
    )
  expect(render('data:application/pdf;base64,JVBERi0=')).toContain('download="report.pdf"')
  expect(render('javascript:alert(1)')).not.toContain('href=')
})
