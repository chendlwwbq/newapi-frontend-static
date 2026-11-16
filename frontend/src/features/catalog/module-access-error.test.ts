import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { ApiError } from '@/lib/api/client'
import { connectReturnPath, modelDetailHref } from './catalog-state'
import { ModuleAccessError } from './module-access-error'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ phase: 'ready', bundle: null }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/pricing/model/connect' }))

describe('connection guide sign-in link', () => {
  it('carries the selected route through the sign-in redirect', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const returnTo = connectReturnPath('vendor/model', 'vip + /测试', 'model/vendor/model', 'route /?#')
    const content = createElement(ModuleAccessError, { error: new ApiError('Unauthorized', 401), retry: () => {}, returnTo })
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n, children: content }))
    expect(html).toContain(`/sign-in?redirect=${encodeURIComponent(returnTo)}`)
  })
  it('does not offer sign-in for other errors', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const content = createElement(ModuleAccessError, { error: new ApiError('Forbidden', 403), retry: () => {}, returnTo: '/pricing/model/connect' })
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n, children: content }))
    expect(html).not.toContain('/sign-in?redirect=')
  })
  it('preserves the model and selected group through a detail-page sign-in', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const returnTo = modelDetailHref('vendor/model', 'model/vendor/model', 'vip + /测试')
    const content = createElement(ModuleAccessError, { error: new ApiError('Unauthorized', 401), retry: () => {}, returnTo })
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n, children: content }))
    expect(html).toContain(`/sign-in?redirect=${encodeURIComponent(returnTo)}`)
    expect(new URL(returnTo, 'https://eva.test').searchParams.get('group')).toBe('vip + /测试')
  })
})
