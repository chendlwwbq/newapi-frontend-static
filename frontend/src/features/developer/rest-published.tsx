'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Braces } from 'lucide-react'
import { api } from '@/lib/api/client'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { CopyButton } from '@/components/shared/copy-button'
import { Input } from '@/components/ui/input'
import { Reveal } from '@/components/motion/reveal'
import { PublishedDocLinks } from './published-documentation'
import { RestOperationReference } from './rest-operation-reference'
import type { RestDefinition } from './types'

export function RestPublishedCatalog() {
  const { t } = useTranslation(),
    [keyword, setKeyword] = useState('')
  const query = useQuery({ queryKey: ['rest-published'], queryFn: ({ signal }) => api<RestDefinition[]>('/api/rest-api/published', { signal }) })
  const items = query.data?.filter((item) =>
    `${item.name} ${item.slug} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(keyword.toLowerCase())
  )
  return (
    <section className="console-panel rest-directory">
      <div className="section-heading">
        <div>
          <h2>{t('REST API directory')}</h2>
          <p className="small-note">{t('Call REST APIs with your New API key. Successful responses are billed per call.')}</p>
        </div>
        <Link href="/docs/library" className="text-link">
          {t('Developer documentation')} ↗
        </Link>
      </div>
      <label className="search-field">
        <Input
          aria-label={t('Search REST APIs')}
          placeholder={t('Search REST APIs')}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </label>
      {query.error && <ErrorState error={query.error} retry={() => query.refetch()} />}
      {query.isPending && <LoadingState />}
      {query.data && !items?.length && <EmptyState title={t('No published REST APIs yet')} />}
      {!!items?.length && (
        <div className="developer-rest-grid">
          {items.map((item) => (
            <Reveal key={item.id} compact>
              <Link className="developer-rest-card" href={`/api-hub/${encodeURIComponent(item.slug)}`}>
                <div className="rest-card-heading">
                  <span className="rest-api-mark">
                    <Braces size={22} />
                  </span>
                  <span className="rest-card-group">{item.group || 'REST API'}</span>
                  <ArrowUpRight size={18} />
                </div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="rest-card-tags">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div className="rest-card-footer">
                  <span>
                    {item.operations.length} {t('REST operations')}
                  </span>
                  <span>{t('View API')} →</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  )
}

export function RestPublishedDetail(props: { slug: string }) {
  const query = useQuery({
    queryKey: ['rest-published', props.slug],
    queryFn: ({ signal }) => api<RestDefinition>(`/api/rest-api/published/${encodeURIComponent(props.slug)}`, { signal }),
  })
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  if (query.isPending) return <LoadingState />
  return <RestPublishedContent item={query.data} />
}

function RestPublishedContent(props: { item: RestDefinition }) {
  const { t } = useTranslation(),
    item = props.item
  const [operationID, setOperationID] = useState<number | null>(null)
  useEffect(() => {
    const selectHash = () => {
      const id = Number(location.hash.replace('#operation-', ''))
      if (item.operations.some((op) => op.id === id)) setOperationID(id)
    }
    selectHash()
    window.addEventListener('hashchange', selectHash)
    return () => window.removeEventListener('hashchange', selectHash)
  }, [item.operations])
  const selected = item.operations.find((op) => op.id === operationID) || item.operations[0]
  return (
    <>
      <div className="console-page-heading">
        <div>
          <Link className="text-link" href="/api-hub">
            ← {t('API hub')}
          </Link>
          <h1>{item.name}</h1>
          <p>{item.description}</p>
        </div>
      </div>
      <p className="small-note developer-stage-note">
        {t('Successful 2xx responses are billed once using your native billing group. Errors are refunded; redirects are not followed.')}
      </p>
      <PublishedDocLinks docs={item.docs || []} />
      {!selected && <EmptyState />}
      {selected && (
        <div className="rest-detail-layout">
          <nav className="rest-operations-nav" aria-label={t('REST operations')}>
            <h2>{t('REST operations')}</h2>
            {item.operations.map((op) => (
              <a
                key={op.id}
                href={`#operation-${op.id}`}
                aria-current={selected.id === op.id ? 'location' : undefined}
                onClick={() => setOperationID(op.id)}
              >
                <span className={`rest-method rest-method-${op.method.toLowerCase()}`}>{op.method}</span>
                <span>
                  <strong>{op.summary || op.operation_id}</strong>
                  <code>{op.path}</code>
                </span>
              </a>
            ))}
          </nav>
          <section className="console-panel developer-operation rest-operation-detail" id={`operation-${selected.id}`}>
            <div className="rest-operation-heading">
              <span className={`rest-method rest-method-${selected.method.toLowerCase()}`}>{selected.method}</span>
              <code>{selected.path}</code>
              <CopyButton value={`${selected.method} ${selected.path}`} />
            </div>
            <h2>{selected.summary || selected.operation_id}</h2>
            <p>{selected.description}</p>
            <RestOperationReference key={selected.id} api={item} operation={selected} />
            <PublishedDocLinks docs={selected.docs || []} />
            <details>
              <summary>{t('OpenAPI definition')}</summary>
              <CopyButton value={JSON.stringify(selected.definition, null, 2)} />
              <pre>{JSON.stringify(selected.definition, null, 2)}</pre>
            </details>
          </section>
        </div>
      )}
      <section className="console-panel developer-operation">
        <details>
          <summary>{t('Shared schemas')}</summary>
          <CopyButton value={JSON.stringify(item.schemas || {}, null, 2)} />
          <pre>{JSON.stringify(item.schemas || {}, null, 2)}</pre>
        </details>
      </section>
    </>
  )
}
