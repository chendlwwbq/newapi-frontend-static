'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { bootstrapSession } from '@/lib/auth/session'
import { SetupGuard } from '@/features/auth/setup-guard'
import { loadInterfaceLanguage, persistInterfaceLanguage } from '@/i18n/load-language'

export function Providers({ children, initialLanguage, initialTranslations }: {
  children: ReactNode
  initialLanguage: string
  initialTranslations: Record<string, string>
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } } })
  )
  const [i18n] = useState(() => {
    const instance = createInstance()
    void instance.init({
      lng: initialLanguage,
      fallbackLng: 'en',
      resources: { [initialLanguage]: { translation: initialTranslations } },
      interpolation: { escapeValue: false },
      initAsync: false,
      keySeparator: false,
    })
    return instance
  })
  useEffect(() => {
    void bootstrapSession()
    const savedLanguage = localStorage.getItem('new-api:language') || initialLanguage
    void loadInterfaceLanguage(i18n, savedLanguage)
      .then(async (language) => {
        await i18n.changeLanguage(language)
        persistInterfaceLanguage(language)
      })
      .catch(() => {})
    const theme = localStorage.getItem('new-api:theme')
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
  }, [i18n, initialLanguage])
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <SetupGuard>{children}</SetupGuard>
          <Toaster richColors position="bottom-right" />
        </MotionConfig>
      </QueryClientProvider>
    </I18nextProvider>
  )
}
