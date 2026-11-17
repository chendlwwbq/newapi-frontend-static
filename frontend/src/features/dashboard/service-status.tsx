'use client'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { toIntlLocale } from '@/i18n/languages'

type UptimeGroup = { categoryName: string; monitors: { name: string; uptime: number; status: number; group?: string }[] }
const states: Record<number, { label: string; className: string }> = {
  0: { label: 'Down', className: 'down' },
  1: { label: 'Operational', className: 'up' },
  2: { label: 'Pending', className: 'pending' },
  3: { label: 'Maintenance', className: 'maintenance' },
}
export function ServiceStatus({ enabled }: { enabled: boolean }) {
  const { t, i18n } = useTranslation()
  const query = useQuery({
    queryKey: ['uptime'],
    enabled,
    queryFn: ({ signal }) => api<UptimeGroup[]>('/api/uptime/status', { signal, anonymous: true }),
    staleTime: 30_000,
  })
  return (
    <section className="console-panel">
      <div className="console-page-heading">
        <h2>{t('Service status')}</h2>
        {enabled && (
          <Button variant="outline" loading={query.isFetching} onClick={() => query.refetch()}>
            {t('Refresh')}
          </Button>
        )}
      </div>
      {!enabled ? (
        <EmptyState title={t('Uptime monitoring is disabled')} />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : !query.data.length ? (
        <EmptyState title={t('No monitoring groups configured')} />
      ) : (
        <>
          {query.data.map((group, index) => (
            <article className="uptime-group" key={`${group.categoryName}:${index}`}>
              <h3>{group.categoryName}</h3>
              {!group.monitors.length ? (
                <EmptyState title={t('No monitoring data available')} />
              ) : (
                <ul>
                  {group.monitors.map((monitor, position) => {
                    const state = states[monitor.status] || { label: 'Unknown', className: 'unknown' }
                    return (
                      <li key={`${monitor.name}:${position}`}>
                        <div>
                          <strong>{monitor.name}</strong>
                          {monitor.group && <span className="small-note">{monitor.group}</span>}
                        </div>
                        <span className={`uptime-state ${state.className}`}>
                          <i aria-hidden />
                          {t(state.label)}
                        </span>
                        <span className="small-note">
                          {t('24-hour uptime')}:{' '}
                          {new Intl.NumberFormat(toIntlLocale(i18n.language), { style: 'percent', maximumFractionDigits: 2 }).format(monitor.uptime)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
          ))}
          <p className="small-note">
            {t('Last updated')}: {new Date(query.dataUpdatedAt).toLocaleTimeString(toIntlLocale(i18n.language))}
          </p>
        </>
      )}
    </section>
  )
}
export function ServiceStatusPage() {
  const { t } = useTranslation()
  const status = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => api<{ uptime_kuma_enabled: boolean }>('/api/status', { signal, anonymous: true }),
  })
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Service status')}</h1>
          <p>{t('Availability reported by the configured monitoring services.')}</p>
        </div>
      </div>
      {status.error ? (
        <ErrorState error={status.error} retry={() => status.refetch()} />
      ) : status.isPending ? (
        <LoadingState />
      ) : (
        <ServiceStatus enabled={status.data.uptime_kuma_enabled} />
      )}
    </>
  )
}
