'use client'
import { useState } from 'react'
import { Globe2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { INTERFACE_LANGUAGE_OPTIONS } from '@/i18n/languages'
import { api } from '@/lib/api/client'
import { useQueryClient } from '@tanstack/react-query'
import { loadInterfaceLanguage, persistInterfaceLanguage } from '@/i18n/load-language'

export function LanguageSwitcher({ saveToAccount = false }: { saveToAccount?: boolean }) {
  const { t, i18n } = useTranslation()
  const [busy, setBusy] = useState(false)
  const queries = useQueryClient()

  async function change(language: string) {
    setBusy(true)
    try {
      await loadInterfaceLanguage(i18n, language)

      if (saveToAccount) {
        let native = language
        if (language === 'zh') native = 'zhCN'
        if (language === 'zh-TW') native = 'zhTW'
        await api('/api/user/self', { method: 'PUT', body: { language: native } })
        void queries.invalidateQueries({ queryKey: ['self'] })
      }

      await i18n.changeLanguage(language)
      persistInterfaceLanguage(language)

      if (saveToAccount) toast.success(t('Language preference saved'))
    } catch {
      toast.error(t('Could not load language'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="language-switcher">
      <Globe2 size={15} aria-hidden="true" />
      <select aria-label={t('Language')} value={i18n.language} disabled={busy} onChange={(event) => void change(event.target.value)}>
        {INTERFACE_LANGUAGE_OPTIONS.map((language) => {
          let value: string = language.code
          if (value === 'zhCN') value = 'zh'
          if (value === 'zhTW') value = 'zh-TW'
          return (
            <option key={value} value={value}>
              {language.label}
            </option>
          )
        })}
      </select>
    </label>
  )
}
