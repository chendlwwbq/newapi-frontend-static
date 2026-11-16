import type { Metadata } from 'next'
import { connection } from 'next/server'
import { cookies } from 'next/headers'
import { Inter, JetBrains_Mono, Noto_Sans_SC } from 'next/font/google'
import { Providers } from '@/components/providers'
import { loadServerLanguage } from '@/i18n/server-language'
import { toIntlLocale } from '@/i18n/languages'
import '@/styles/globals.css'

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const fontChinese = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-zh',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: { default: 'eva', template: '%s · eva' },
  description: 'eva · All models, one place. Powered by New API.',
  icons: { icon: '/orbis/favicon.svg' },
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection()
  const preference = (await cookies()).get('new_api_language')?.value || 'zh'
  const initial = await loadServerLanguage(preference)
  const htmlLang = toIntlLocale(initial.language) || 'zh-CN'
  return (
    <html
      lang={htmlLang}
      className={`${fontSans.variable} ${fontMono.variable} ${fontChinese.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <Providers initialLanguage={initial.language} initialTranslations={initial.translations}>{children}</Providers>
      </body>
    </html>
  )
}
