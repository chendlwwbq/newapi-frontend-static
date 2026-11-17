'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/shared/states'
import type { ReactNode } from 'react'

export function ContentPage({
  title,
  content,
  eyebrow,
  description,
  fallbackDescription,
  children,
}: {
  title: string
  content: string
  eyebrow?: string
  description?: string
  fallbackDescription?: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const hasContent = !!content.trim()

  return (
    <main className="page-container py-10 sm:py-14" id="content">
      <article className="docs-article mx-auto max-w-4xl">
        <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-primary/[0.06] via-card/80 to-card/50 p-6 sm:p-8 shadow-sm">
          <div className="docs-eyebrow">{eyebrow || `eva · ${t('Public documentation')}`}</div>
          <h1 className="mt-2">{t(title)}</h1>
          {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t(description)}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileText size={13} aria-hidden="true" />
              {t(hasContent ? 'Latest published version' : 'Not configured')}
            </span>
            <Link className="text-link" href="/docs">
              {t('Help center')} ↗
            </Link>
          </div>
        </header>
        {hasContent ? (
          <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6 sm:p-8 leading-7 text-foreground/90 shadow-xs">
            {children || content}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6 sm:p-8">
            <EmptyState
              title={t(title)}
              description={t(
                fallbackDescription || 'The site administrator has not configured custom page content yet.'
              )}
              action={
                <>
                  <Link className="pill-button" href="/">
                    {t('Return home')}
                  </Link>
                  <Link className="pill-button secondary" href="/pricing">
                    {t('Models')}
                  </Link>
                  <Link className="pill-button secondary" href="/docs">
                    {t('Help center')}
                  </Link>
                </>
              }
            />
          </div>
        )}
      </article>
    </main>
  )
}
