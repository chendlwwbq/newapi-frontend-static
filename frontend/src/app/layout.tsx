import type { Metadata } from 'next'
import { connection } from 'next/server'
import { cookies } from 'next/headers'
import { Providers } from '@/components/providers'
import { loadServerLanguage } from '@/i18n/server-language'
import { toIntlLocale } from '@/i18n/languages'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'eva', template: '%s · eva' },
  description: 'eva · All models, one place. Powered by New API.',
  icons: { icon: '/orbis/favicon.svg' },
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection()
  const preference = (await cookies()).get('new_api_language')?.value || 'zh'
  const initial = await loadServerLanguage(preference)
  return (
    <html lang={toIntlLocale(initial.language)} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Providers initialLanguage={initial.language} initialTranslations={initial.translations}>{children}</Providers>
      </body>
    </html>
  )
}
