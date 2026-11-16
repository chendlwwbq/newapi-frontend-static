'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm } from './shared'
import { OpsNav } from './ops-nav'
import { InstanceDetails } from './instance-details'
import { formatNumber } from '@/lib/format'
import type { PerformanceStats, SystemInstance } from './ops-types'

export function OpsOverview() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    root = bundle?.user.role === 100
  const [auto, setAuto] = useState(false),
    [removing, setRemoving] = useState<SystemInstance | 'all' | null>(null),
    [selected, setSelected] = useState<SystemInstance | null>(null)
  const instances = useQuery({
    queryKey: ['system-instances', bundle?.user.id],
    enabled: root,
    queryFn: ({ signal }) => api<SystemInstance[]>('/api/system-info/instances', { signal }),
    refetchInterval: auto ? 30_000 : false,
  })
  const stats = useQuery({
    queryKey: ['performance', bundle?.user.id],
    enabled: root,
    queryFn: ({ signal }) => api<PerformanceStats>('/api/performance/stats', { signal }),
    refetchInterval: auto ? 30_000 : false,
  })
  const remove = useMutation({
    mutationFn: (value: SystemInstance | 'all') =>
      api(value === 'all' ? '/api/system-info/stale-instances' : `/api/system-info/instances/${encodeURIComponent(value.node_name)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setRemoving(null)
      void queries.invalidateQueries({ queryKey: ['system-instances'] })
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const locale = toIntlLocale(i18n.language)
  const date = (value?: number) => (value ? new Date(value * 1000).toLocaleString(locale, { hour12: false }) : '—')
  const bytes = (value?: number) => (value === undefined ? '—' : `${formatNumber(value / 1048576, locale)} MiB`)
  const percent = (value?: number) => (value === undefined ? '—' : `${formatNumber(value, locale)}%`)
  let performanceContent
  if (stats.error) performanceContent = <ErrorState error={stats.error} retry={() => stats.refetch()} />
  else if (stats.isPending) performanceContent = <LoadingState />
  else {
    const data = stats.data,
      cache = data.cache_stats,
      memory = data.memory_stats,
      disk = data.disk_space_info,
      config = data.config
    const groups: [string, [string, string][]][] = [
      [
        'Runtime resources',
        [
          ['System memory', bytes(memory.sys)],
          ['Total allocated memory', bytes(memory.total_alloc)],
          ['GC count', formatNumber(memory.num_gc, locale)],
          ['Total disk space', bytes(disk.total)],
          ['Used disk space', bytes(disk.used)],
          ['Free disk space', bytes(disk.free)],
        ],
      ],
      [
        'Cache resources',
        [
          ['Memory cache', bytes(cache.current_memory_usage_bytes)],
          ['Active memory buffers', formatNumber(cache.active_memory_buffers, locale)],
          ['Memory cache hits', formatNumber(cache.memory_cache_hits, locale)],
          ['Disk cache hits', formatNumber(cache.disk_cache_hits, locale)],
          ['Active disk files', formatNumber(cache.active_disk_files, locale)],
          ['Disk cache maximum', bytes(cache.disk_cache_max_bytes)],
          ['Disk cache threshold', bytes(cache.disk_cache_threshold_bytes)],
          ['Cache directory exists', t(data.disk_cache_info.exists ? 'Yes' : 'No')],
          ['Cache files', formatNumber(data.disk_cache_info.file_count, locale)],
          ['Cache directory size', bytes(data.disk_cache_info.total_size)],
          ['Disk cache path', data.disk_cache_info.path],
        ],
      ],
      [
        'Runtime configuration',
        [
          ['Disk cache enabled', t(config.disk_cache_enabled ? 'Yes' : 'No')],
          ['Performance monitoring', t(config.monitor_enabled ? 'Enabled' : 'Disabled')],
          ['Running in container', t(config.is_running_in_container ? 'Yes' : 'No')],
          ['Configured disk cache path', config.disk_cache_path],
          ['Disk cache threshold (MiB)', formatNumber(config.disk_cache_threshold_mb, locale)],
          ['Disk cache maximum (MiB)', formatNumber(config.disk_cache_max_size_mb, locale)],
          ['CPU alert threshold', percent(config.monitor_cpu_threshold)],
          ['Memory alert threshold', percent(config.monitor_memory_threshold)],
          ['Disk alert threshold', percent(config.monitor_disk_threshold)],
        ],
      ],
    ]
    performanceContent = (
      <>
        <div className="ops-stat-grid">
          {[
            ['Allocated memory', bytes(memory.alloc)],
            ['Goroutines', formatNumber(memory.num_goroutine, locale)],
            ['Disk usage', percent(disk.used_percent)],
            ['Disk cache', bytes(cache.current_disk_usage_bytes)],
          ].map(([label, value]) => (
            <section
              className="console-panel rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10"
              key={label}
            >
              <span className="small-note">{t(label)}</span>
              <strong className="text-2xl md:text-3xl font-semibold tracking-tight tabular-nums font-mono">{value}</strong>
            </section>
          ))}
        </div>
        {groups.map(([title, rows]) => (
          <section className="console-panel" key={title}>
            <h2>{t(title)}</h2>
            <dl className="ops-details">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{t(label)}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </>
    )
  }
  let instanceContent
  if (instances.error) instanceContent = <ErrorState error={instances.error} retry={() => instances.refetch()} />
  else if (instances.isPending) instanceContent = <LoadingState />
  else if (!instances.data.length) instanceContent = <EmptyState />
  else
    instanceContent = (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {['Instance', 'Status', 'Version', 'CPU', 'Memory', 'Disk usage', 'Started at', 'Last seen', 'Actions'].map((label) => (
                <th key={label}>{t(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instances.data.map((instance) => {
              let role = '—'
              if (instance.info?.role?.is_master !== undefined) role = t(instance.info.role.is_master ? 'Master' : 'Worker')
              return (
                <tr key={instance.node_name}>
                  <td>
                    <strong>{instance.node_name}</strong>
                    <div className="small-note">{role}</div>
                  </td>
                  <td>
                    <span className={`status-badge ${instance.status === 'online' ? 'success' : ''}`}>
                      {instance.status === 'online' && (
                        <span className="relative flex size-2" aria-hidden="true">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                        </span>
                      )}
                      {t(instance.status === 'online' ? 'Online' : 'Stale')}
                    </span>
                  </td>
                  <td className="tabular-nums font-mono">{instance.info?.runtime?.version || '—'}</td>
                  <td className="tabular-nums font-mono">{percent(instance.info?.resources?.cpu?.usage_percent)}</td>
                  <td className="tabular-nums font-mono">{percent(instance.info?.resources?.memory?.usage_percent)}</td>
                  <td className="tabular-nums font-mono">{percent(instance.info?.resources?.storage?.used_percent)}</td>
                  <td className="small-note tabular-nums font-mono">{date(instance.started_at)}</td>
                  <td className="small-note tabular-nums font-mono">{date(instance.last_seen_at)}</td>
                  <td>
                    <div className="action-buttons">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(instance)}>
                        {t('Details')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={instance.status !== 'stale'}
                        aria-label={`${t('Remove')} ${instance.node_name}`}
                        onClick={() => setRemoving(instance)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  if (!root) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Operations')}</h1>
          <p>{t('Live instance health, runtime resources and cache usage.')}</p>
        </div>
        <div className="action-buttons">
          <label className="checkbox-label">
            <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
            {t('Auto refresh')}
          </label>
          <Button
            variant="outline"
            aria-label={t('Refresh')}
            onClick={() => {
              void instances.refetch()
              void stats.refetch()
            }}
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>
      <OpsNav />
      {performanceContent}
      <div className="console-page-heading">
        <h2>{t('System instances')}</h2>
        <Button variant="outline" disabled={!instances.data?.some((instance) => instance.status === 'stale')} onClick={() => setRemoving('all')}>
          {t('Remove stale instances')}
        </Button>
      </div>
      {instanceContent}
      {selected && <InstanceDetails instance={selected} date={date} bytes={bytes} percent={percent} onClose={() => setSelected(null)} />}
      {removing && (
        <AdminConfirm
          title={t('Remove stale instances')}
          description={removing === 'all' ? t('Only stale instance records are removed. Running services are not stopped.') : removing.node_name}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  )
}
