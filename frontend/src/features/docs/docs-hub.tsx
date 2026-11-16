'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookOpen, ChevronRight, Search, ThumbsUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion/reveal'
import { Mascot } from '@/components/motion/mascot'
import { DocumentationLinks, type PublishedDocSummary } from '@/features/developer/published-documentation'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { api } from '@/lib/api/client'
import { docsCatalog, publishedDocsToEntries, searchDocs } from './docs-catalog'
import { guides } from './guides'
import { useDocSearchShortcut } from './use-doc-search-shortcut'

const popular = [
  ['Getting started', '/docs/getting-started'],
  ['Models, routes and API keys', '/docs/models-and-routes'],
  ['Choose a model', '/docs/choose-model'],
  ['Choose a route', '/docs/choose-route'],
  ['Connect asynchronous tasks', '/docs/async-tasks'],
  ['Video generation', '/docs/video-generation'],
  ['Errors', '/docs/errors'],
]
const onboarding = [
  ['Create account', '/sign-up'],
  ['Create API key', '/keys'],
  [
    'Send a request',
    `/docs/getting-started#section-${guides['getting-started'].sections.findIndex((section) => section.title === 'Send a request')}`,
  ],
]
const tasks = [
  ['Choose a route', '/docs/async-tasks#section-0'],
  ['Send a request', '/docs/async-tasks#section-1'],
  ['Verify the result', '/docs/async-tasks#section-2'],
]

export function DocsHub() {
  const { t } = useTranslation(),
    router = useRouter(),
    input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const published = useQuery({
    queryKey: ['developer-published', '/api/developer-docs/published'],
    queryFn: ({ signal }) => api<PublishedDocSummary[]>('/api/developer-docs/published', { signal }),
  })
  const results = searchDocs(query, (key) => t(key), [...docsCatalog, ...publishedDocsToEntries(published.error ? [] : published.data || [])])
  const searching = !!query.trim()
  useDocSearchShortcut(input)
  return (
    <main id="content" className="docs-hub">
      <section className="docs-hub-hero">
        <Reveal>
          <span className="docs-hub-badge">
            <i />
            {t('Help center')} · Docs
          </span>
          <h1>{t('How can we help?')}</h1>
          <p>{t('From your first API call to client setup and troubleshooting, start here.')}</p>
        </Reveal>
        <div className="docs-hub-search-wrap">
          <div className="docs-search-mascot">
            <Mascot />
          </div>
          <form
            role="search"
            className="docs-hub-search"
            onSubmit={(event) => {
              event.preventDefault()
              if (searching && results[0]) router.push(results[0].href)
            }}
          >
            <Search size={20} aria-hidden="true" />
            <Input
              ref={input}
              type="search"
              aria-label={t('Search documentation')}
              placeholder={t('Search questions or paste an error message')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setQuery('')
                }
              }}
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQuery('')
                  input.current?.focus()
                }}
              >
                {t('Clear')}
              </Button>
            ) : (
              <kbd aria-hidden="true">⌘ K</kbd>
            )}
          </form>
        </div>
        <nav className="docs-popular" aria-label={t('Popular topics')}>
          <span>{t('Popular topics')}</span>
          {popular.map(([title, href]) => (
            <Link href={href} key={href}>
              {t(title)}
            </Link>
          ))}
        </nav>
      </section>
      <div className="docs-hub-body">
        {searching ? (
          <section className="docs-search-results" aria-label={t('Search results')}>
            <h2>{t('Search results')}</h2>
            {published.isPending && <LoadingState />}
            {published.error && (
              <ErrorState
                error={published.error}
                retry={() => {
                  void published.refetch()
                }}
              />
            )}
            {(results.length > 0 || (!published.isPending && !published.error)) && (
              <p role="status" className="small-note">
                {results.length ? t('Matching documentation') : t('No matching documentation. Try a model, protocol or error code.')}
              </p>
            )}
            <div className="docs-topic-grid">
              {results.map((entry) => (
                <Link className="docs-topic-link" key={entry.id} href={entry.href}>
                  <span>{t(entry.category)}</span>
                  <h3>{entry.id.startsWith('published:') ? entry.title : t(entry.title)}</h3>
                  <p>{entry.id.startsWith('published:') ? entry.description : t(entry.description)}</p>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <>
            <div className="docs-hub-columns">
              <Reveal className="docs-hub-card">
                <h2>
                  <i className="docs-dot" />
                  {t('New here?')}
                </h2>
                <p>{t('Create an account, choose a model and make your first API call.')}</p>
                <ol className="docs-steps">
                  {onboarding.map(([title, href], index) => (
                    <li key={href}>
                      <Link href={href}>
                        <span>0{index + 1}</span>
                        {t(title)}
                        <ChevronRight size={14} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link className="docs-card-cta" href="/docs/getting-started">
                  {t('Get started')} <ArrowRight size={15} />
                </Link>
                <div className="docs-card-library">
                  <BookOpen size={17} />
                  <Link href="/docs/library">
                    {t('Developer documentation')} <ArrowRight size={14} />
                  </Link>
                </div>
                <DocumentationLinks path="/api/developer-docs/published" />
              </Reveal>
              <Reveal className="docs-hub-card docs-helpful-card" delay={0.06}>
                <div className="docs-card-heading">
                  <h2>
                    <ThumbsUp size={19} aria-hidden="true" />
                    {t('Most helpful')}
                  </h2>
                  <Link href="/docs/all">
                    {t('View all')} <ArrowRight size={13} />
                  </Link>
                </div>
                <p>{t('Essential guides')}</p>
                <ol className="docs-helpful">
                  {popular
                    .filter(([, href]) => href !== '/docs/async-tasks')
                    .map(([title, href], index) => (
                      <li key={href}>
                        <Link href={href}>
                          <span>0{index + 1}</span>
                          <div>
                            <h3>{t(title)}</h3>
                            <small>
                              <i className="docs-dot" />
                              {t(title === 'Errors' ? 'Troubleshooting' : 'Integration guides')}
                            </small>
                          </div>
                          <ChevronRight size={14} />
                        </Link>
                      </li>
                    ))}
                </ol>
              </Reveal>
              <Reveal className="docs-hub-card" delay={0.12}>
                <h2>
                  <i className="docs-dot docs-dot-blue" />
                  {t('Connect asynchronous tasks')}
                </h2>
                <p>{t('Submit a task, keep its ID, check its status, then retrieve the completed result.')}</p>
                <ol className="docs-steps">
                  {tasks.map(([title, href], index) => (
                    <li key={href}>
                      <Link href={href}>
                        <span>0{index + 1}</span>
                        {t(title)}
                        <ChevronRight size={14} />
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link className="docs-card-cta" href="/docs/async-tasks">
                  {t('Get started')} <ArrowRight size={15} />
                </Link>
                <div className="docs-task-decoration" aria-hidden="true">
                  <span>POST</span>
                  <span>task_id</span>
                  <span>GET</span>
                  <span>✓</span>
                </div>
              </Reveal>
            </div>
            <section className="docs-all-topics" id="all-docs">
              <div className="docs-topics-heading">
                <div>
                  <span className="docs-eyebrow">eva · Docs</span>
                  <h2>{t('All topics')}</h2>
                </div>
                <Link href="/docs/api">
                  {t('API reference')} <ArrowRight size={15} />
                </Link>
              </div>
              {['Integration guides', 'Troubleshooting', 'Clients'].map((category) => (
                <div className="docs-topic-section" key={category}>
                  <h3>{t(category)}</h3>
                  <div className="docs-topic-grid">
                    {docsCatalog
                      .filter((entry) => entry.category === category)
                      .map((entry) => (
                        <Link className="docs-topic-link" key={entry.id} href={entry.href}>
                          <BookOpen size={19} aria-hidden="true" />
                          <h3>{t(entry.title)}</h3>
                          <p>{t(entry.description)}</p>
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
