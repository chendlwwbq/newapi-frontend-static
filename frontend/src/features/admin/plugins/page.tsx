'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Eye, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm, AdminPagination, AdminSearch } from '../shared'
import { PluginActionDialog, type PluginAction } from './actions'
import { PluginDetailDialog } from './detail'
import { PluginUploadDialog } from './upload'
import { PluginRuntimePanel } from './runtime'
import { PluginMarketplace } from './marketplace'
import { PluginIcon } from './plugin-icon'
import type { PluginUpload, TaskPlugin } from './types'

const runtimeLabels: Record<string, string> = {
  registered: 'Registered',
  compile_failed: 'Compile failed',
  disabled: 'Disabled',
  disabled_fallback: 'Disabled fallback',
  not_registered: 'Not registered',
}
function TaskPluginsContent() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const [tab, setTab] = useState('installed'),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState('')
  const [detailKey, setDetailKey] = useState(''),
    [upload, setUpload] = useState<PluginUpload | null>(null),
    [action, setAction] = useState<PluginAction | null>(null),
    [globalConfirm, setGlobalConfirm] = useState(false)
  const query = useQuery({
    queryKey: ['task-plugins', bundle!.user.id, bundle!.session.sid],
    queryFn: ({ signal }) => api<TaskPlugin[]>('/api/plugin/task', { signal }),
  })
  const global = useQuery({
    queryKey: ['task-plugin-global', bundle!.user.id, bundle!.session.sid],
    queryFn: async ({ signal }) =>
      (await api<{ key: string; value: string }[]>('/api/option', { signal })).find((option) => option.key === 'TaskPluginEnabled')?.value === 'true',
  })
  const toggleGlobal = useMutation({
    mutationFn: () => api('/api/option', { method: 'PUT', body: { key: 'TaskPluginEnabled', value: String(!global.data) } }),
    onSuccess: () => {
      setGlobalConfirm(false)
      void queries.invalidateQueries({ queryKey: ['task-plugin-global'] })
      void queries.invalidateQueries({ queryKey: ['system-options'] })
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const filtered = (query.data || []).filter(
    (plugin) =>
      `${plugin.meta.key} ${plugin.meta.name} ${plugin.meta.models?.join(' ')}`.toLowerCase().includes(search.toLowerCase()) &&
      (!filter || String(plugin.enabled) === filter)
  )
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Task plugins')}</h1>
          <p>{t('Manage plugin sources, versions and the gateway runtime registry.')}</p>
        </div>
        <div className="action-buttons">
          <Button variant="outline" onClick={() => query.refetch()} aria-label={t('Refresh')}>
            <RefreshCw size={15} />
          </Button>
          <Button onClick={() => setUpload({ source: '', remark: '' })}>{t('Upload plugin')}</Button>
        </div>
      </div>
      <section className="console-panel plugin-global">
        <div>
          <strong>{t('Task plugin engine')}</strong>
          {global.error ? (
            <p className="inline-error">{t(global.error.message)}</p>
          ) : (
            <p className="small-note">{t(global.isPending ? 'Loading' : global.data ? 'Enabled' : 'Disabled')}</p>
          )}
        </div>
        <Button variant="outline" disabled={global.isPending || !!global.error} onClick={() => setGlobalConfirm(true)}>
          {t(global.data ? 'Disable' : 'Enable')}
        </Button>
      </section>
      <div className="admin-subnav" role="tablist" aria-label={t('Task plugins')}>
        {[
          ['installed', 'Installed plugins'],
          ['marketplace', 'Marketplace'],
          ['runtime', 'Plugin runtime'],
        ].map(([id, label]) => (
          <Button key={id} role="tab" aria-selected={tab === id} variant={tab === id ? 'default' : 'outline'} onClick={() => setTab(id)}>
            {t(label)}
          </Button>
        ))}
      </div>
      {tab === 'installed' && (
        <>
          <AdminSearch
            onSearch={(value) => {
              setSearch(value)
              setPage(1)
            }}
          >
            <select
              className="plain-select"
              aria-label={t('Status')}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="">{t('All statuses')}</option>
              <option value="true">{t('Enabled')}</option>
              <option value="false">{t('Disabled')}</option>
            </select>
          </AdminSearch>
          {query.error ? (
            <ErrorState error={query.error} retry={() => query.refetch()} />
          ) : query.isPending ? (
            <LoadingState />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table plugin-table">
                  <thead>
                    <tr>
                      {['Plugin', 'Version', 'Source', 'Runtime status', 'Models', 'Channels', 'In-flight tasks', 'Actions'].map((label) => (
                        <th key={label} className={label === 'Actions' ? 'table-sticky-action' : undefined}>
                          {t(label)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice((page - 1) * 20, page * 20).map((plugin) => (
                      <tr key={plugin.meta.key}>
                        <td>
                          <div className="plugin-identity">
                            <PluginIcon
                              pluginKey={plugin.meta.key}
                              name={plugin.meta.name}
                              icon={plugin.meta.icon}
                              hasIcon={plugin.has_icon}
                              version={plugin.meta.version}
                              sourceHash={plugin.source_hash}
                            />
                            <strong>{plugin.meta.name}</strong>
                          </div>
                          <small className="small-note plugin-key">{plugin.meta.key}</small>
                          <p className="small-note">
                            {plugin.meta.description?.[i18n.language] || plugin.meta.description?.en || plugin.meta.description?.zh}
                          </p>
                        </td>
                        <td>{plugin.meta.version}</td>
                        <td>
                          {t(plugin.source === 'factory' ? 'Built-in' : 'Uploaded')}
                          {plugin.source === 'override_over_factory' && <small className="plugin-key">{t('Overrides built-in')}</small>}
                        </td>
                        <td>
                          <span className="tag">{t(runtimeLabels[plugin.runtime_status] || plugin.runtime_status)}</span>
                          {plugin.runtime_error && <p className="inline-error">{t(plugin.runtime_error)}</p>}
                        </td>
                        <td>
                          {plugin.meta.models?.slice(0, 3).join(', ')}
                          {(plugin.meta.models?.length || 0) > 3 && '…'}
                        </td>
                        <td>{plugin.source === 'override' ? plugin.channel_count : '—'}</td>
                        <td>{plugin.source === 'override' ? plugin.in_flight_count : '—'}</td>
                        <td className="table-sticky-action">
                          <div className="action-buttons">
                            <Button
                              size="icon"
                              variant="outline"
                              aria-label={`${t('Details')} ${plugin.meta.key}`}
                              onClick={() => setDetailKey(plugin.meta.key)}
                            >
                              <Eye size={15} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setAction({
                                  kind: 'status',
                                  key: plugin.meta.key,
                                  enabled: !plugin.enabled,
                                  channels: plugin.source === 'override' ? plugin.channel_count : undefined,
                                  inFlight: plugin.source === 'override' ? plugin.in_flight_count : undefined,
                                })
                              }
                            >
                              {t(plugin.enabled ? 'Disable' : 'Enable')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && <EmptyState title={t('No data')} />}
              <AdminPagination page={page} total={filtered.length} onPage={setPage} />
            </>
          )}
        </>
      )}
      {tab === 'runtime' && <PluginRuntimePanel />}
      {tab === 'marketplace' && <PluginMarketplace installed={query.data || []} onInstall={setUpload} />}
      {detailKey && !action && <PluginDetailDialog pluginKey={detailKey} key={detailKey} onClose={() => setDetailKey('')} onAction={setAction} />}
      {action && <PluginActionDialog action={action} onClose={() => setAction(null)} />}
      {upload && (
        <PluginUploadDialog
          initial={upload}
          onClose={() => setUpload(null)}
          onSaved={(key) => {
            setUpload(null)
            setDetailKey(key)
          }}
        />
      )}
      {globalConfirm && (
        <AdminConfirm
          title={t(global.data ? 'Disable task plugin engine' : 'Enable task plugin engine')}
          description={t('This changes task plugin handling for the gateway. Review active tasks and channel configuration before confirming.')}
          busy={toggleGlobal.isPending}
          onClose={() => setGlobalConfirm(false)}
          onConfirm={() => toggleGlobal.mutate()}
        />
      )}
    </>
  )
}
export function TaskPluginsPage() {
  const { bundle } = useAuth(),
    { t } = useTranslation()
  if (bundle?.user.role !== 100) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  return <TaskPluginsContent key={`${bundle.user.id}:${bundle.session.sid}`} />
}
