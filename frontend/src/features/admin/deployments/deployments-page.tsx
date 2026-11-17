'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminSearch, AdminPagination, AdminConfirm } from '../shared'
import { MetadataNav } from '../metadata-nav'
import { CreateDeployment } from './create-deployment'
import { DeploymentDialog, type DeploymentDialogMode } from './deployment-dialog'
import { deploymentPath } from './contracts'
import type { Deployment, DeploymentSettings } from './types'
export function DeploymentsPage() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    locale = toIntlLocale(i18n.language)
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [status, setStatus] = useState(''),
    [auto, setAuto] = useState(false),
    [creating, setCreating] = useState(false),
    [dialog, setDialog] = useState<{ deployment: Deployment; mode: DeploymentDialogMode } | null>(null),
    [deleting, setDeleting] = useState<Deployment | null>(null)
  const settings = useQuery({
    queryKey: ['deployment-settings', bundle?.user.id],
    queryFn: ({ signal }) => api<DeploymentSettings>('/api/deployments/settings', { signal }),
  })
  const list = useQuery({
    queryKey: ['deployments', bundle?.user.id, page, keyword, status],
    enabled: settings.data?.can_connect === true,
    queryFn: ({ signal }) =>
      api<{ items: Deployment[]; total: number; status_counts: Record<string, number> }>(
        `/api/deployments/${keyword ? 'search' : ''}?${new URLSearchParams({ p: String(page), page_size: '20', keyword, status })}`,
        { signal }
      ),
    refetchInterval: auto ? 30_000 : false,
  })
  const connection = useMutation({
    gcTime: 0,
    mutationFn: () => api('/api/deployments/settings/test-connection', { method: 'POST', body: {} }),
    onSuccess: () => toast.success(t('Connection successful')),
    onError: (error) => toast.error(t(error.message)),
  })
  function saved() {
    setCreating(false)
    setDialog(null)
    void queries.invalidateQueries({ queryKey: ['deployments'] })
    void queries.invalidateQueries({ queryKey: ['deployment-detail'] })
    toast.success(t('Saved'))
  }
  const remove = useMutation({
    mutationFn: (id: string) => api(deploymentPath(id), { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null)
      saved()
    },
    onError: (error) => toast.error(t(error.message)),
  })
  let listContent
  if (list.error) listContent = <ErrorState error={list.error} retry={() => list.refetch()} />
  else if (list.isPending) listContent = <LoadingState />
  else if (!list.data?.items.length) listContent = <EmptyState title={t('No deployments')} />
  else
    listContent = (
      <>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {['Deployment name', 'Status', 'Hardware', 'Remaining minutes', 'Actions'].map((label) => (
                  <th key={label} className={label === 'Actions' ? 'table-sticky-action' : undefined}>
                    {t(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.deployment_name || row.container_name || row.id}</strong>
                    <div className="small-note">{row.id}</div>
                  </td>
                  <td>{row.status}</td>
                  <td>
                    {row.brand_name} {row.hardware_name} × {formatNumber(row.hardware_quantity, locale)}
                  </td>
                  <td>{formatNumber(row.compute_minutes_remaining, locale)}</td>
                  <td className="table-sticky-action">
                    <div className="deployment-row-actions">
                      {(['detail', 'edit', 'rename', 'extend'] as const).map((mode) => (
                        <Button key={mode} size="sm" variant="outline" onClick={() => setDialog({ deployment: row, mode })}>
                          {t({ detail: 'Details', edit: 'Edit', rename: 'Rename', extend: 'Extend deployment' }[mode])}
                        </Button>
                      ))}
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(row)}>
                        {t('Terminate')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} total={list.data.total} onPage={setPage} />
      </>
    )
  let content
  if (settings.error) content = <ErrorState error={settings.error} retry={() => settings.refetch()} />
  else if (settings.isPending) content = <LoadingState />
  else if (!settings.data?.can_connect)
    content = (
      <section className="console-panel">
        <EmptyState title={t('Model deployment is not configured')} description={t('Enable io.net and save its API key in model settings.')} />
        {bundle?.user.role === 100 && (
          <Link className="pill-button secondary" href="/system-settings/models">
            {t('Model settings')}
          </Link>
        )}
      </section>
    )
  else
    content = (
      <>
        <section className="console-panel">
          <div className="action-buttons">
            <Button variant="outline" loading={connection.isPending} onClick={() => connection.mutate()}>
              {t('Test connection')}
            </Button>
            <Button variant="outline" loading={list.isFetching} onClick={() => list.refetch()}>
              {t('Refresh')}
            </Button>
            <label className="checkbox-label">
              <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
              {t('Auto refresh')}
            </label>
          </div>
          <AdminSearch
            onSearch={(value) => {
              setKeyword(value)
              setPage(1)
            }}
          >
            <label>
              {t('Status')}
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  setPage(1)
                }}
              >
                {['', 'running', 'pending', 'deploying', 'completed', 'failed', 'terminated'].map((value) => (
                  <option key={value} value={value}>
                    {value || t('All')}
                  </option>
                ))}
              </select>
            </label>
          </AdminSearch>
          {listContent}
        </section>
      </>
    )
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Model deployments')}</h1>
          <p>{t('Manage io.net resources, containers and logs through the native gateway.')}</p>
        </div>
        <Button disabled={!settings.data?.can_connect} onClick={() => setCreating(true)}>
          {t('Create deployment')}
        </Button>
      </div>
      <MetadataNav />
      {content}
      {creating && <CreateDeployment onClose={() => setCreating(false)} onSaved={saved} />}{' '}
      {dialog && <DeploymentDialog {...dialog} onClose={() => setDialog(null)} onSaved={saved} />}{' '}
      {deleting && (
        <AdminConfirm
          title={t('Terminate deployment')}
          description={t('This stops the provider deployment and its containers. Provider charges may still apply.')}
          busy={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
        />
      )}
    </>
  )
}
