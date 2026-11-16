import 'server-only'
import { resourceLanguage, type ResourceLanguage } from './load-language'

// Only the selected locale is loaded on the server and passed into hydration.
// Other locales stay out of the initial client JavaScript bundle.
const resources: Record<ResourceLanguage, () => Promise<{ default: { translation: Record<string, string> } }>> = {
  zh: () => import('../../public/locales/zh.json'),
  'zh-TW': () => import('../../public/locales/zh-TW.json'),
  en: () => import('../../public/locales/en.json'),
  fr: () => import('../../public/locales/fr.json'),
  ja: () => import('../../public/locales/ja.json'),
  ru: () => import('../../public/locales/ru.json'),
  vi: () => import('../../public/locales/vi.json'),
}

export async function loadServerLanguage(code: string) {
  const language = resourceLanguage(code)
  const resource = await resources[language]()
  return { language, translations: resource.default.translation }
}
