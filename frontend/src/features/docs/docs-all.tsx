'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { api } from '@/lib/api/client'
import type { PublishedDocSummary } from '@/features/developer/published-documentation'
import { docsCatalog, publishedDocsToEntries, searchDocs } from './docs-catalog'
import { useDocSearchShortcut } from './use-doc-search-shortcut'

const categories = ['All', 'Integration guides', 'Troubleshooting', 'Clients', 'Developer documentation'] as const

export function DocsAll() {
  const { t } = useTranslation()
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState<string>('All')
  const input = useRef<HTMLInputElement>(null)
  useDocSearchShortcut(input)
  const published = useQuery({
    queryKey: ['developer-published', '/api/developer-docs/published'],
    queryFn: ({ signal }) => api<PublishedDocSummary[]>('/api/developer-docs/published', { signal }),
  })
  const results = searchDocs(query, (key) => t(key), [...docsCatalog, ...publishedDocsToEntries(published.data || [])]).filter(
    (entry) => category === 'All' || entry.category === category
  )
  return (
    <main id="content" className="page-container docs-all-page">
      <p className="docs-eyebrow">
        <Link href="/docs">{t('Help center')}</Link> / Docs
      </p>
      <h1 className="page-title">{t('All topics')}</h1>
      <label className="docs-all-search">
        <Search size={18} aria-hidden="true" />
        <Input
          ref={input}
          type="search"
          aria-label={t('Search documentation')}
          placeholder={t('Search documentation')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setQuery('')
            }
          }}
        />
        <kbd aria-hidden="true">⌘ K</kbd>
      </label>
      <div className="docs-all-categories" role="group" aria-label={t('All topics')}>
        {categories.map((item) => (
          <Button key={item} type="button" variant="outline" aria-pressed={category === item} onClick={() => setCategory(item)}>
            {t(item)}
          </Button>
        ))}
      </div>
      {published.isPending && <LoadingState />}
      {published.error && (
        <ErrorState
          error={published.error}
          retry={() => {
            void published.refetch()
          }}
        />
      )}
      {!results.length && !published.isPending && !published.error && (
        <p role="status">{t('No matching documentation. Try a model, protocol or error code.')}</p>
      )}
      <div className="docs-topic-grid docs-all-list">
        {results.map((entry) => (
          <Link className="docs-topic-link" key={entry.id} href={entry.href}>
            <span>{t(entry.category)}</span>
            <h2>{entry.id.startsWith('published:') ? entry.title : t(entry.title)}</h2>
            <p>{entry.id.startsWith('published:') ? entry.description : t(entry.description)}</p>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </main>
  )
}
