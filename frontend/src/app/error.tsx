'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { RotateCw } from 'lucide-react'
import { Brand } from '@/components/layout/public-shell'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation()
  const diagnostic = [error.digest ? `digest=${error.digest}` : '', error.message?.trim() || ''].filter(Boolean).join(' · ')

  return (
    <main className="not-found px-4 py-12">
      <header>
        <Brand />
      </header>
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border/60 bg-card/80 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="space-y-2">
          <span className="not-found-status inline-block rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-destructive">
            status = <strong>500</strong>
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('Something went wrong')}</h1>
        </div>
        <ErrorState error={error} />
        {diagnostic && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/50 px-3 py-2 text-left">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={diagnostic}>
              {diagnostic}
            </code>
            <CopyButton value={diagnostic} label={t('Copy')} />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={reset}>
            <RotateCw size={14} />
            {t('Retry')}
          </Button>
          <Link className="pill-button secondary" href="/pricing">
            {t('Models')}
          </Link>
          <Link className="pill-button secondary" href="/dashboard/overview">
            {t('Overview')}
          </Link>
        </div>
        <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <Link className="text-link" href="/">
            {t('Return home')}
          </Link>
        </div>
      </div>
    </main>
  )
}
