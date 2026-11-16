'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm } from './shared'
import { OpsNav } from './ops-nav'

type Action = { path: string; method: string; title: string; description: string }
type LogFiles = {
  enabled: boolean
  log_dir: string
  file_count: number
  total_size: number
  files?: { name: string; size: number; mod_time: string }[]
}
const actions = [
  {
    path: '/api/performance/disk_cache',
    method: 'DELETE',
    title: 'Clear inactive disk cache',
    description: 'Clear cache files unused for more than ten minutes.',
  },
  {
    path: '/api/performance/reset_stats',
    method: 'POST',
    title: 'Reset cache statistics',
    description: 'Reset cache hit counters without changing model or billing configuration.',
  },
  { path: '/api/performance/gc', method: 'POST', title: 'Run garbage collection', description: 'Request garbage collection in the gateway process.' },
]
export function OpsMaintenance() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    root = bundle?.user.role === 100
  const [confirm, setConfirm] = useState<Action | null>(null),
    [mode, setMode] = useState('by_days'),
    [keep, setKeep] = useState(30)
  const logs = useQuery({
    queryKey: ['performance-logs', bundle?.user.id],
    enabled: root,
    queryFn: ({ signal }) => api<LogFiles>('/api/performance/logs', { signal }),
  })
  const action = useMutation({
    mutationFn: (value: Action) => api(value.path, { method: value.method }),
    onSuccess: () => {
      setConfirm(null)
      for (const key of ['performance', 'performance-logs']) void queries.invalidateQueries({ queryKey: [key] })
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  if (!root) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Maintenance')}</h1>
          <p>{t('Manage runtime caches and gateway log files.')}</p>
        </div>
      </div>
      <OpsNav />
      <div className="ops-action-grid">
        {actions.map((item) => (
          <section className="console-panel" key={item.path}>
            <h2>{t(item.title)}</h2>
            <p className="small-note">{t(item.description)}</p>
            <Button variant="outline" onClick={() => setConfirm(item)}>
              {t('Run')}
            </Button>
          </section>
        ))}
      </div>
      <section className="console-panel">
        <h2>{t('Log files')}</h2>
        {logs.error ? (
          <ErrorState error={logs.error} retry={() => logs.refetch()} />
        ) : logs.isPending ? (
          <LoadingState />
        ) : !logs.data.enabled ? (
          <EmptyState title={t('Log directory is not configured')} />
        ) : (
          <>
            <p className="small-note">
              {logs.data.log_dir} · {logs.data.file_count} {t('Files')} · {(logs.data.total_size / 1048576).toFixed(1)} MiB
            </p>
            <div className="console-toolbar admin-toolbar">
              <label className="field">
                <span>{t('Retention mode')}</span>
                <select value={mode} onChange={(event) => setMode(event.target.value)}>
                  <option value="by_days">{t('Days to keep')}</option>
                  <option value="by_count">{t('Files to keep')}</option>
                </select>
              </label>
              <label className="field">
                <span>{t('Keep')}</span>
                <input type="number" min={1} step={1} value={keep} onChange={(event) => setKeep(Number(event.target.value))} />
              </label>
              <Button
                variant="destructive"
                disabled={!Number.isSafeInteger(keep) || keep < 1}
                onClick={() =>
                  setConfirm({
                    path: `/api/performance/logs?${new URLSearchParams({ mode, value: String(keep) })}`,
                    method: 'DELETE',
                    title: 'Clean up log files',
                    description: `${t(mode === 'by_days' ? 'Days to keep' : 'Files to keep')}: ${keep}. ${t('The active log file is preserved.')}`,
                  })
                }
              >
                {t('Clean up log files')}
              </Button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Name', 'Size', 'Updated'].map((label) => (
                      <th key={label}>{t(label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.data.files?.map((file) => (
                    <tr key={file.name}>
                      <td>{file.name}</td>
                      <td>{(file.size / 1048576).toFixed(2)} MiB</td>
                      <td>{new Date(file.mod_time).toLocaleString(toIntlLocale(i18n.language), { hour12: false })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      {confirm && (
        <AdminConfirm
          title={t(confirm.title)}
          description={t(confirm.description)}
          busy={action.isPending}
          onConfirm={() => action.mutate(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}
