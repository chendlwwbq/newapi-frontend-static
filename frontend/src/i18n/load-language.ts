import type { i18n } from 'i18next'
import { toIntlLocale } from './languages'

export type ResourceLanguage = 'zh' | 'zh-TW' | 'en' | 'fr' | 'ja' | 'ru' | 'vi'
const pending = new WeakMap<i18n, Map<ResourceLanguage, Promise<ResourceLanguage>>>()

export function resourceLanguage(code: string): ResourceLanguage {
  if (['zhCN', 'zh-CN', 'zh'].includes(code)) return 'zh'
  if (['zhTW', 'zh-TW'].includes(code)) return 'zh-TW'
  if (['en', 'fr', 'ja', 'ru', 'vi'].includes(code)) return code as ResourceLanguage
  return 'en'
}

export function persistInterfaceLanguage(code: string) {
  const language = resourceLanguage(code)
  localStorage.setItem('new-api:language', language)
  document.cookie = `new_api_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`
  document.documentElement.lang = toIntlLocale(language) || 'en'
}

/** Native language preferences use zhCN/zhTW; frontend resources use zh/zh-TW. */
export async function loadInterfaceLanguage(instance: i18n, code: string) {
  const language = resourceLanguage(code)
  if (instance.hasResourceBundle(language, 'translation') && Object.keys(instance.getResourceBundle(language, 'translation')).length > 0) {
    return language
  }
  let requests = pending.get(instance)
  if (!requests) {
    requests = new Map()
    pending.set(instance, requests)
  }
  let request = requests.get(language)
  if (!request) {
    request = (async () => {
      const response = await fetch(`/locales/${language}.json`)
      if (!response.ok) throw new Error('Could not load language')
      const resource = await response.json()
      instance.addResourceBundle(language, 'translation', resource.translation || resource, true, true)
      return language
    })().finally(() => requests.delete(language))
    requests.set(language, request)
  }
  return request
}
