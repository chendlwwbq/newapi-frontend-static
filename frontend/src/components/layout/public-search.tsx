'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { Search, ArrowUpRight, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api/client'
import type { Catalog } from '@/lib/api/types'
import { useAuth, refreshSession } from '@/lib/auth/session'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { modelHref, ProviderIcon } from '@/features/catalog/model-card'
import { ModuleAccessError } from '@/features/catalog/module-access-error'
import { readCatalogFilters, filterCatalog, catalogListKey } from '@/features/catalog/catalog-state'
import { publishedDocsToEntries, searchDocs } from '@/features/docs/docs-catalog'
import type { PublishedDocSummary } from '@/features/developer/published-documentation'

export default function PublicSearch({
  open,
  onOpenChange,
  allowModels,
  allowDocs,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  allowModels: boolean
  allowDocs: boolean
}) {
  const { t } = useTranslation(),
    auth = useAuth(),
    [search, setSearch] = useState(''),
    results = useRef<HTMLDivElement>(null)
  const query = useQuery({
    queryKey: catalogListKey('CNY', auth.bundle),
    enabled: open && allowModels && auth.phase === 'ready',
    queryFn: ({ signal }) => api<Catalog>('/api/catalog/models?currency=CNY', { signal }),
  })
  const published = useQuery({
    queryKey: ['developer-published', '/api/developer-docs/published'],
    enabled: open && allowDocs,
    queryFn: ({ signal }) => api<PublishedDocSummary[]>('/api/developer-docs/published', { signal }),
  })
  const models =
    allowModels && auth.phase !== 'error' && !query.error
      ? filterCatalog(query.data?.models || [], readCatalogFilters(new URLSearchParams({ q: search }).toString())).slice(0, 8)
      : []
  const docs = allowDocs ? searchDocs(search, (key) => t(key)).slice(0, 6) : []
  const publishedDocs =
    allowDocs && !published.error ? searchDocs(search, (key) => t(key), publishedDocsToEntries(published.data || [])).slice(0, 6) : []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="public-search-dialog">
        <DialogHeader>
          <DialogTitle>{t('Search models and docs')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            results.current?.querySelector<HTMLAnchorElement>('a')?.click()
          }}
        >
          <label className="search-field">
            <Search size={18} />
            <input
              autoFocus
              type="search"
              aria-label={t('Search models and docs')}
              placeholder={t('Search models and docs')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  results.current?.querySelector<HTMLAnchorElement>('a')?.focus()
                }
              }}
            />
            <kbd>↵</kbd>
          </label>
        </form>
        <div className="public-search-results" ref={results}>
          {allowModels && (
            <section>
              <h3>{t('Models')}</h3>
              {auth.phase === 'error' ? (
                <ErrorState
                  error={new Error(auth.error || 'Session refresh failed')}
                  retry={() => {
                    void refreshSession().catch((error) => toast.error(t(error.message)))
                  }}
                />
              ) : query.error ? (
                <ModuleAccessError error={query.error} retry={() => query.refetch()} />
              ) : query.isPending ? (
                <LoadingState />
              ) : null}
              {models.map((model) => (
                <Link key={model.model_key} href={modelHref(model)} onClick={() => onOpenChange(false)}>
                  <ProviderIcon provider={model.provider} modelName={model.configured_model_id} icon={model.icon} size={26} />
                  <div>
                    <strong>{model.name}</strong>
                    <small>{model.configured_model_id}</small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </section>
          )}
          {!!docs.length && (
            <section>
              <h3>{t('Docs')}</h3>
              {docs.map((doc) => (
                <Link key={doc.id} href={doc.href} onClick={() => onOpenChange(false)}>
                  <FileText size={20} />
                  <div>
                    <strong>{t(doc.title)}</strong>
                    <small>{t(doc.description)}</small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </section>
          )}
          {allowDocs && (!!publishedDocs.length || published.error) && (
            <section>
              <h3>{t('Developer documentation')}</h3>
              {published.error && (
                <ErrorState
                  error={published.error}
                  retry={() => {
                    void published.refetch()
                  }}
                />
              )}
              {publishedDocs.map((doc) => (
                <Link key={doc.id} href={doc.href} onClick={() => onOpenChange(false)}>
                  <FileText size={20} />
                  <div>
                    <strong>{doc.title}</strong>
                    <small>{doc.description}</small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </section>
          )}
          {!models.length &&
            !docs.length &&
            !publishedDocs.length &&
            (!allowDocs || (!published.isPending && !published.error)) &&
            (!allowModels || (auth.phase !== 'error' && !query.isPending && !query.error)) && <EmptyState title={t('No results')} />}
        </div>
        <p className="small-note">{t('Press Enter to open the first result. Use Tab to browse and Escape to close.')}</p>
      </DialogContent>
    </Dialog>
  )
}
