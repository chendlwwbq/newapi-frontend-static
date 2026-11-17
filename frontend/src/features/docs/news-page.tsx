'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { toIntlLocale } from '@/i18n/languages'
import { EmptyState } from '@/components/shared/states'
import type { ReactNode } from 'react'

export type NewsArticle = { id: number; slug: string; title: string; excerpt: string; published_at: string; body?: string }
export function NewsPage({ articles, article, children }: { articles?: NewsArticle[]; article?: NewsArticle; children?: ReactNode }) {
  const { t, i18n } = useTranslation()
  const dateFormatter = new Intl.DateTimeFormat(toIntlLocale(i18n.resolvedLanguage || i18n.language), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const formatDate = (iso: string) => {
    const parsed = new Date(iso)
    return Number.isNaN(parsed.getTime()) ? iso : dateFormatter.format(parsed)
  }
  return (
    <main className="page-container news-page" id="content">
      {article ? (
        <article className="news-article">
          <Link className="text-link" href="/news">
            ← {t('News')}
          </Link>
          <time className="tabular-nums font-mono" dateTime={article.published_at}>
            {formatDate(article.published_at)}
          </time>
          <h1>{article.title}</h1>
          {article.excerpt && <p className="page-description leading-relaxed">{article.excerpt}</p>}
          <div className="news-body">{children}</div>
        </article>
      ) : (
        <>
          <div className="section-heading">
            <div>
              <p className="docs-eyebrow">eva</p>
              <h1 className="page-title">{t('News')}</h1>
              <p className="page-description leading-relaxed">{t('Product updates and service announcements.')}</p>
            </div>
          </div>
          {articles?.length ? (
            <div className="news-grid">
              {articles.map((item) => (
                <Link
                  className="news-card rounded-2xl border-border/60 bg-card/70 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10"
                  href={`/news/${encodeURIComponent(item.slug)}`}
                  key={item.id}
                >
                  <time className="tabular-nums font-mono" dateTime={item.published_at}>
                    {formatDate(item.published_at)}
                  </time>
                  <h2 className="font-semibold leading-[1.45]">{item.title}</h2>
                  <p className="leading-relaxed">{item.excerpt}</p>
                  <span>{t('Read article')} ↗</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title={t('No published articles yet')} />
          )}
        </>
      )}
    </main>
  )
}
