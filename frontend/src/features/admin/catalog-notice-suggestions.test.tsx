import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { SettingsCollectionEditor } from './settings-collection-editor'
import { catalogListKey } from '@/features/catalog/catalog-state'
import type { AuthBundle, Catalog } from '@/lib/api/types'

const bundle = { user: { id: 7, group: 'admin' }, session: { sid: 'test' } } as AuthBundle
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle }) }))

describe('catalog notice target suggestions', () => {
  it('connects editable target inputs to the current account catalog', async () => {
    const client = new QueryClient()
    client.setQueryData(catalogListKey('CNY', bundle), {
      models: [
        {
          model_key: 'model/example',
          configured_model_id: 'example',
          name: 'Example',
          offerings: [{ name: 'vip', offering_key: 'group-vip/example' }],
        },
      ],
    } as Catalog)
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const value = JSON.stringify([{ public_message: 'Notice', models: ['model/example'], groups: ['vip'], offering_keys: ['group-vip/example'] }])
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <SettingsCollectionEditor id="catalog" optionKey="OrbisCatalogNotices" value={value} onChange={() => {}} />
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('list="catalog-suggestions-models"')
    expect(html).toContain('list="catalog-suggestions-groups"')
    expect(html).toContain('list="catalog-suggestions-offering_keys"')
    expect(html).toContain('value="group-vip/example" label="Example · vip"')
  })
})
