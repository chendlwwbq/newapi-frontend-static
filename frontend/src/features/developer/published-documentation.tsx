'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Reveal } from '@/components/motion/reveal'
import { api } from '@/lib/api/client'
import { EmptyState, ErrorState } from '@/components/shared/states'
import type { DeveloperDoc, DocSummary } from './types'

export type PublishedDocSummary = Pick<DeveloperDoc, 'id' | 'slug' | 'title' | 'summary' | 'source_type' | 'external_url' | 'language'>
export function DocumentationLibrary({ docs }: { docs: PublishedDocSummary[] }) {
  const { t } = useTranslation()
  return (
    <main className="page-container developer-library" id="content">
      <p className="docs-eyebrow">
        <span className="brand-word">eva</span>
      </p>
      <h1 className="page-title">{t('Developer documentation')}</h1>
      <p className="page-description">{t('Published integration guides and API documentation.')}</p>
      {docs.length ? (
        <div className="news-grid">
          {docs.map((doc) => (
            <Reveal key={doc.id} compact>
              <Link className="news-card" href={`/docs/published/${encodeURIComponent(doc.slug)}`} key={doc.id}>
                <span>
                  {doc.language} · {t(doc.source_type === 'markdown' ? 'Markdown' : 'External link')}
                </span>
                <h2>{doc.title}</h2>
                <p>{doc.summary}</p>
                <span>{t('Read documentation')} ↗</span>
              </Link>
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyState title={t('No published documentation yet')} />
      )}
    </main>
  )
}
export function PublishedDocumentation(props: { doc: PublishedDocSummary; children?: ReactNode; notice?: { title: string; text: string } }) {
  const { t } = useTranslation()
  return (
    <main className="page-container developer-library" id="content">
      <article className="news-article">
        <Link href="/docs/library" className="text-link">
          ← {t('Developer documentation')}
        </Link>
        <p className="small-note" style={{ marginTop: 28 }}>
          {props.doc.language} · {t(props.doc.source_type === 'markdown' ? 'Markdown' : 'External link')}
        </p>
        <h1>{props.doc.title}</h1>
        {props.doc.summary && <p className="page-description">{props.doc.summary}</p>}
        <div className="news-body">
          {props.notice && (
            <section>
              <h2>{t(props.notice.title)}</h2>
              <p>{t(props.notice.text)}</p>
            </section>
          )}
          {props.doc.source_type === 'external' ? (
            <a className="pill-button" href={props.doc.external_url} target="_blank" rel="noopener noreferrer">
              {t('Open external docs')} ↗
            </a>
          ) : (
            props.children
          )}
        </div>
      </article>
    </main>
  )
}
export function PublishedDocLinks({ docs }: { docs: DocSummary[] }) {
  const { t } = useTranslation()
  if (!docs.length) return null
  return (
    <section className="developer-documentation-links">
      <h2>{t('Developer documentation')}</h2>
      {docs.map((doc) => (
        <Link className="developer-doc-link" key={doc.id} href={`/docs/published/${encodeURIComponent(doc.slug)}`}>
          <strong>{doc.title}</strong>
          <span>{doc.summary}</span>
          <small>{doc.language} ↗</small>
        </Link>
      ))}
    </section>
  )
}
export function DocumentationLinks({ path }: { path: string }) {
  const query = useQuery({ queryKey: ['developer-published', path], queryFn: ({ signal }) => api<DeveloperDoc[]>(path, { signal }), staleTime: 0 })
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  if (!query.data?.length) return null
  return <PublishedDocLinks docs={query.data} />
}
export function ModelDocumentation({ model }: { model: string }) {
  return <DocumentationLinks path={`/api/developer-docs/models/${encodeURIComponent(model)}`} />
}
