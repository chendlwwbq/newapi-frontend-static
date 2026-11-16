'use client'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import type { Catalog } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { catalogListKey } from '@/features/catalog/catalog-state'

export function CatalogNoticeSuggestions({ id }: { id: string }) {
  const { t } = useTranslation(),
    auth = useAuth()
  const query = useQuery({
    queryKey: catalogListKey('CNY', auth.bundle),
    enabled: auth.phase === 'ready',
    queryFn: ({ signal }) => api<Catalog>('/api/catalog/models?currency=CNY', { signal }),
  })
  const models = new Map<string, string>(),
    groups = new Set<string>(),
    offerings = new Map<string, string>()
  if (!query.error)
    for (const model of query.data?.models || []) {
      models.set(model.model_key, model.name)
      models.set(model.configured_model_id, model.name)
      for (const route of model.offerings) {
        groups.add(route.name)
        offerings.set(route.offering_key, `${model.name} · ${route.name}`)
      }
    }
  return (
    <>
      <p className="small-note">{t('Suggestions show models and routes visible to your account. You can also enter other identifiers manually.')}</p>
      {query.error && (
        <p className="small-note">
          {t('Suggestions unavailable.')}{' '}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void query.refetch()
            }}
          >
            {t('Retry')}
          </Button>
        </p>
      )}
      <datalist id={`${id}-suggestions-models`}>
        {[...models].map(([value, label]) => (
          <option key={value} value={value} label={label} />
        ))}
      </datalist>
      <datalist id={`${id}-suggestions-groups`}>
        {[...groups].map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id={`${id}-suggestions-offering_keys`}>
        {[...offerings].map(([value, label]) => (
          <option key={value} value={value} label={label} />
        ))}
      </datalist>
    </>
  )
}
