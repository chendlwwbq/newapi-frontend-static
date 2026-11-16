'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { toIntlLocale } from '@/i18n/languages'
import { EmptyState } from '@/components/shared/states'
import type { ReactNode } from 'react'

export type NewsArticle = { id: number; slug: string; title: string; excerpt: string; published_at: string; body?: string }
export function NewsPage({ articles, article, children }: { articles?: NewsArticle[]; article?: NewsArticle; children?: ReactNode }) {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(toIntlLocale(i18n.language), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  return (
    <main className="page-container news-page" id="content">
      {article ? (
        <article className="news-article">
          <Link className="text-link" href="/news">
            ← {t('News')}
          </Link>
          <time dateTime={article.published_at}>{date.format(new Date(article.published_at))}</time>
          <h1>{article.title}</h1>
          {article.excerpt && <p className="page-description">{article.excerpt}</p>}
          <div className="news-body">{children}</div>
        </article>
      ) : (
        <>
          <div className="section-heading">
            <div>
              <p className="docs-eyebrow">eva</p>
              <h1 className="page-title">{t('News')}</h1>
              <p className="page-description">{t('Product updates and service announcements.')}</p>
            </div>
          </div>
          {articles?.length ? (
            <div className="news-grid">
              {articles.map((item) => (
                <Link className="news-card" href={`/news/${encodeURIComponent(item.slug)}`} key={item.id}>
                  <time dateTime={item.published_at}>{date.format(new Date(item.published_at))}</time>
                  <h2>{item.title}</h2>
                  <p>{item.excerpt}</p>
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
