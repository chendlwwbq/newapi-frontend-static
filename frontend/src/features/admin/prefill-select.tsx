'use client'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { ErrorState } from '@/components/shared/states'
import type { PrefillGroup } from './prefill-groups-page'

export function PrefillSelect({ type, onSelect }: { type: PrefillGroup['type']; onSelect: (items: string) => void }) {
  const { t } = useTranslation(),
    { bundle } = useAuth()
  const query = useQuery({
    queryKey: ['prefill-groups', bundle?.user.id],
    queryFn: ({ signal }) => api<PrefillGroup[]>('/api/prefill_group', { signal }),
    staleTime: 60_000,
  })
  return (
    <>
      {query.data?.some((group) => group.type === type) && (
        <label className="field">
          <span>{t('Apply preset')}</span>
          <select
            value=""
            onChange={(event) => {
              const group = query.data.find((group) => group.id === Number(event.target.value))
              if (!group) return
              if (type === 'endpoint') {
                onSelect(typeof group.items === 'string' ? group.items : JSON.stringify(group.items, null, 2))
                return
              }
              try {
                const items: unknown =
                  typeof group.items === 'string'
                    ? group.items.trim().startsWith('[')
                      ? JSON.parse(group.items)
                      : group.items.split(/[\n,]/)
                    : group.items
                if (Array.isArray(items))
                  onSelect(
                    items
                      .filter((item) => typeof item === 'string')
                      .map((value) => value.trim())
                      .filter(Boolean)
                      .join(',')
                  )
              } catch {
                toast.error(t('Invalid JSON object'))
              }
            }}
          >
            <option value="">{t('Select preset')}</option>
            {query.data
              .filter((group) => group.type === type)
              .map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
          </select>
        </label>
      )}
      {query.error && <ErrorState error={query.error} retry={() => query.refetch()} />}
    </>
  )
}
