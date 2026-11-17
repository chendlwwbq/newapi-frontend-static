'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Brand } from '@/components/layout/public-shell'
import { Mascot } from '@/components/motion/mascot'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <main className="not-found">
      <header>
        <Brand />
      </header>
      <div className="not-found-content w-full max-w-lg rounded-2xl border border-border/60 bg-card/80 !p-8 sm:!p-10 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <Mascot />
        <span className="not-found-status rounded-full border border-border/70 bg-muted/60 px-3 py-1">
          status = <strong>404</strong>
        </span>
        <h1>{t('Page not found')}</h1>
        <p>{t('The link may have expired or the page may have moved.')}</p>
        <div className="not-found-actions flex-wrap">
          <Link className="pill-button" href="/">
            {t('Return home')}
          </Link>
          <Link className="pill-button secondary" href="/pricing">
            {t('Models')}
          </Link>
          <Button variant="outline" onClick={() => window.history.back()}>
            {t('Back')}
          </Button>
        </div>
        <nav aria-label={t('Explore')}>
          <Link href="/dashboard/overview">{t('Overview')}</Link>
          <Link href="/docs">{t('Help center')}</Link>
        </nav>
      </div>
    </main>
  )
}
