'use client'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import type { PluginRuntime } from './types'

export function PluginRuntimePanel() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth()
  const query = useQuery({
    queryKey: ['task-plugin-runtime', bundle?.user.id, bundle?.session.sid],
    queryFn: ({ signal }) => api<PluginRuntime>('/api/plugin/task/runtime/status', { signal }),
  })
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  if (query.isPending) return <LoadingState />
  const runtime = query.data
  const rebuildLabels: Record<string, string> = { success: 'Succeeded', partial: 'Partial', failed: 'Failed', never: 'Never' }
  const date = (value: string) => (value && !value.startsWith('0001') ? new Date(value).toLocaleString(toIntlLocale(i18n.language)) : '—')
  return (
    <section className="console-panel">
      <div className="console-page-heading">
        <div>
          <h2>{t('Plugin runtime')}</h2>
          <p>{t('Registry state on the responding gateway instance. Other instances may have a different generation.')}</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          {t('Refresh')}
        </Button>
      </div>
      <dl className="plugin-runtime-grid">
        <div>
          <dt>{t('Generation')}</dt>
          <dd>{runtime.current_generation}</dd>
        </div>
        <div>
          <dt>{t('Published at')}</dt>
          <dd>{date(runtime.generation_published_at)}</dd>
        </div>
        <div>
          <dt>{t('Last rebuild')}</dt>
          <dd>
            {t(rebuildLabels[runtime.last_rebuild.status] || runtime.last_rebuild.status)} · {date(runtime.last_rebuild.attempted_at)}
          </dd>
        </div>
        <div>
          <dt>{t('Database revision')}</dt>
          <dd>
            <code>{runtime.database_revision || '—'}</code>
          </dd>
        </div>
      </dl>
      {runtime.database_error && <p className="inline-error">{t(runtime.database_error)}</p>}
      {runtime.last_rebuild.error && <p className="inline-error">{t(runtime.last_rebuild.error)}</p>}
      {Object.keys(runtime.plugin_errors || {}).length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Plugin')}</th>
                <th>{t('Error')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(runtime.plugin_errors).map(([key, error]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td className="inline-error">{t(error)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t('No plugin runtime errors')} />
      )}
    </section>
  )
}
