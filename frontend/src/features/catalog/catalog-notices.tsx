'use client'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { CatalogModel } from '@/lib/api/types'
import { ErrorState } from '@/components/shared/states'
import { applicableNotices, type CatalogNotice } from './notice-state'

export function CatalogNotices({ models, groups = [] }: { models: CatalogModel[]; groups?: string[] }) {
  const { t } = useTranslation(),
    auth = useAuth()
  const query = useQuery({
    queryKey: ['catalog-notices', auth.bundle?.user.id ?? 0, auth.bundle?.user.group ?? '', auth.bundle?.session.sid ?? 'public'],
    enabled: auth.phase === 'ready',
    queryFn: ({ signal }) => api<{ notices: CatalogNotice[] }>('/api/catalog/notices', { signal }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  if (query.error)
    return (
      <ErrorState
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  const notices = applicableNotices(query.data?.notices || [], models, groups)
  if (!notices.length) return null
  return (
    <section className="catalog-notices" aria-label={t('Notice')}>
      <strong>{t('Notice')}</strong>
      <ul>
        {notices.map((notice, index) => (
          <li key={`${notice.public_message}-${index}`}>{notice.public_message}</li>
        ))}
      </ul>
    </section>
  )
}
