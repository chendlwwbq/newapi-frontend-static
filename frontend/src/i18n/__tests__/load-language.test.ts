import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInstance } from 'i18next'
import { loadInterfaceLanguage } from '../load-language'

afterEach(() => vi.unstubAllGlobals())

describe('interface language loading', () => {
  it('reuses the server-provided locale without requesting it again', async () => {
    const instance = createInstance()
    await instance.init({ lng: 'zh', resources: { zh: { translation: { Hello: '你好' } } } })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    expect(await loadInterfaceLanguage(instance, 'zhCN')).toBe('zh')
    expect(instance.t('Hello')).toBe('你好')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads only the selected locale and shares simultaneous requests', async () => {
    const instance = createInstance()
    await instance.init({ lng: 'en', resources: {} })
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ translation: { Hello: 'Bonjour' } })))
    vi.stubGlobal('fetch', fetch)

    await Promise.all([loadInterfaceLanguage(instance, 'fr'), loadInterfaceLanguage(instance, 'fr')])
    await instance.changeLanguage('fr')
    expect(instance.t('Hello')).toBe('Bonjour')
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/locales/fr.json')
    expect(instance.hasResourceBundle('zh', 'translation')).toBe(false)
  })

  it('allows a failed language request to be retried', async () => {
    const instance = createInstance()
    await instance.init({ lng: 'en', resources: {} })
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ translation: { Hello: '你好' } })))
    vi.stubGlobal('fetch', fetch)

    await expect(loadInterfaceLanguage(instance, 'zhTW')).rejects.toThrow('Could not load language')
    expect(await loadInterfaceLanguage(instance, 'zhTW')).toBe('zh-TW')
    await instance.changeLanguage('zh-TW')
    expect(instance.t('Hello')).toBe('你好')
  })
})
