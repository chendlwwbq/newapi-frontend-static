'use client'
import dynamic from 'next/dynamic'
import { PluginIcon } from './plugin-icon'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/copy-button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { HOST_PROTOCOL_ENDPOINTS } from './host-protocols'
import { pluginDryRunRequest } from './transfer'
import type { PluginDetail, PluginRecord } from './types'
import type { PluginAction } from './actions'

const PluginVersionComparison = dynamic(() => import('./version-comparison').then((module) => module.PluginVersionComparison), {
  loading: () => <LoadingState />,
})
const hooks = [
  'buildSubmitRequest',
  'parseSubmitResponse',
  'extractUsage',
  'extractUsageOnSubmit',
  'extractUsageOnComplete',
  'buildQueryRequest',
  'parseTaskResult',
  'buildBatchQueryRequest',
  'parseBatchResult',
  'buildContentRequest',
  'listArtifacts',
  'native.decodeSubmit',
  'native.taskCreated',
  'native.taskStatus',
  'native.error',
]
function PluginSandbox(props: { pluginKey: string }) {
  const { t } = useTranslation(),
    [hook, setHook] = useState(hooks[0]),
    [args, setArgs] = useState('[{}]')
  const [output, setOutput] = useState('')
  const mutation = useMutation({
    mutationFn: () =>
      api<unknown>(`/api/plugin/task/${encodeURIComponent(props.pluginKey)}/dryrun`, { method: 'POST', body: pluginDryRunRequest(hook, args) }),
    onSuccess: (result) => setOutput(JSON.stringify(result, null, 2)),
    onError: () => setOutput(''),
  })
  return (
    <form
      className="plugin-form"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <p className="small-note">
        {t('Dry run uses the current saved version. Unsaved source and the historical version displayed here are not executed.')}
      </p>
      <fieldset disabled={mutation.isPending} className="plugin-form">
        <label className="field">
          {t('Hook')}
          <Input list="plugin-dryrun-hooks" value={hook} required onChange={(event) => setHook(event.target.value)} />
          <datalist id="plugin-dryrun-hooks">
            {hooks.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </label>
        <label className="field">
          {t('Arguments JSON')}
          <Textarea className="admin-pricing-expression" rows={7} value={args} onChange={(event) => setArgs(event.target.value)} />
        </label>
        <Button type="submit">{t(mutation.isPending ? 'Running dry run' : 'Run dry run')}</Button>
      </fieldset>
      {mutation.error && (
        <p role="alert" className="inline-error">
          {t(mutation.error.message)}
        </p>
      )}
      {output && (
        <section>
          <h3>{t('Dry run result')}</h3>
          <pre className="admin-pricing-effective">{output}</pre>
        </section>
      )}
    </form>
  )
}
export function PluginDetailDialog(props: { pluginKey: string; onClose: () => void; onAction: (action: PluginAction) => void }) {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    [tab, setTab] = useState('details'),
    [version, setVersion] = useState('')
  const path = `/api/plugin/task/${encodeURIComponent(props.pluginKey)}`
  const detail = useQuery({
    queryKey: ['task-plugin-detail', bundle?.user.id, bundle?.session.sid, props.pluginKey, version],
    queryFn: ({ signal }) => api<PluginDetail>(`${path}${version ? `?version=${encodeURIComponent(version)}` : ''}`, { signal }),
  })
  const versions = useQuery({
    queryKey: ['task-plugin-versions', bundle?.user.id, bundle?.session.sid, props.pluginKey],
    enabled: ['versions', 'compare'].includes(tab),
    queryFn: ({ signal }) => api<PluginRecord[]>(`${path}/versions`, { signal }),
  })
  const data = detail.data
  const endpoints = [
    ...(data?.meta.routes || []),
    ...(data?.meta.protocols || []).flatMap((claim) => {
      const name = typeof claim === 'string' ? claim : claim.name
      return (HOST_PROTOCOL_ENDPOINTS[name] || []).map((endpoint) => ({ ...endpoint, type: name }))
    }),
  ]
  function download() {
    if (!data) return
    const url = URL.createObjectURL(new Blob([data.source], { type: 'text/javascript;charset=utf-8' })),
      anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${data.meta.key.replace(/[^a-zA-Z0-9._-]/g, '_')}-${data.meta.version.replace(/[^a-zA-Z0-9._-]/g, '_')}.js`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className="admin-dialog plugin-dialog max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="plugin-identity">
            {data && (
              <PluginIcon
                pluginKey={props.pluginKey}
                name={data.meta.name}
                icon={data.meta.icon}
                hasIcon={data.has_icon}
                version={version}
                sourceHash={data.plugin?.source_hash}
              />
            )}
            <span>{data?.meta.name || props.pluginKey}</span>
          </DialogTitle>
          <DialogDescription>
            {props.pluginKey}
            {data && ` @ ${data.meta.version} · ${data.layer}`}
          </DialogDescription>
        </DialogHeader>
        <div className="admin-subnav" role="tablist" aria-label={t('Plugin details')}>
          {[
            ['details', 'Details'],
            ['source', 'Source code'],
            ['versions', 'Versions'],
            ['compare', 'Compare versions'],
            ['sandbox', 'Dry run'],
          ].map(([id, label]) => (
            <Button role="tab" aria-selected={tab === id} variant={tab === id ? 'default' : 'outline'} key={id} onClick={() => setTab(id)}>
              {t(label)}
            </Button>
          ))}
        </div>
        {detail.error ? (
          <ErrorState error={detail.error} retry={() => detail.refetch()} />
        ) : detail.isPending ? (
          <LoadingState />
        ) : (
          data && (
            <>
              {tab === 'details' && (
                <>
                  <div className="plugin-detail-summary">
                    <span>API v{data.meta.apiVersion}</span>
                    <span>{data.meta.author?.name}</span>
                    <span>{t(data.layer === 'factory' ? 'Built-in' : 'Uploaded')}</span>
                  </div>
                  <p>{data.meta.description?.[i18n.language] || data.meta.description?.en || data.meta.description?.zh}</p>
                  <h3>{t('Models')}</h3>
                  <div className="tag-list">
                    {data.meta.models?.map((model) => (
                      <span className="tag" key={model}>
                        {model}
                      </span>
                    ))}
                  </div>
                  <h3>{t('Endpoints')}</h3>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t('Method')}</th>
                          <th>{t('Path')}</th>
                          <th>{t('Type')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoints.map((route, index) => (
                          <tr key={index}>
                            <td>{route.method}</td>
                            <td>
                              <code>{route.path}</code>
                            </td>
                            <td>{route.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <details>
                    <summary>{t('Metadata')}</summary>
                    <pre className="admin-pricing-effective">{JSON.stringify(data.meta, null, 2)}</pre>
                  </details>
                </>
              )}
              {tab === 'source' && (
                <>
                  <div className="action-buttons">
                    <CopyButton value={data.source} />
                    <Button variant="outline" onClick={download}>
                      {t('Download')}
                    </Button>
                  </div>
                  <pre className="admin-pricing-effective plugin-source">{data.source}</pre>
                  {data.plugin && (
                    <p className="small-note">
                      SHA-256: <code>{data.plugin.source_hash}</code>
                    </p>
                  )}
                </>
              )}
              {tab === 'versions' && (
                <>
                  {versions.error ? (
                    <ErrorState error={versions.error} retry={() => versions.refetch()} />
                  ) : versions.isPending ? (
                    <LoadingState />
                  ) : (
                    <>
                      <p className="small-note">{t('Built-in versions are preserved. Uploaded versions can be inspected, activated or deleted.')}</p>
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {['Version', 'Status', 'Created at', 'Remark', 'Actions'].map((label) => (
                                <th key={label}>{t(label)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {versions.data?.map((record) => (
                              <tr key={record.id}>
                                <td>{record.version}</td>
                                <td>
                                  {t(record.active ? 'Active' : 'Inactive')} · {t(record.enabled ? 'Enabled' : 'Disabled')}
                                </td>
                                <td>{new Date(record.created_at * 1000).toLocaleString(toIntlLocale(i18n.language))}</td>
                                <td>{record.remark}</td>
                                <td>
                                  <div className="action-buttons">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setVersion(record.version)
                                        setTab('source')
                                      }}
                                    >
                                      {t('View')}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={record.active}
                                      onClick={() => props.onAction({ kind: 'activate', key: props.pluginKey, version: record.version })}
                                    >
                                      {t('Activate')}
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => props.onAction({ kind: 'delete', key: props.pluginKey, version: record.version })}
                                    >
                                      {t('Delete')}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
              {tab === 'compare' && (
                <>
                  {versions.error ? (
                    <ErrorState error={versions.error} retry={() => versions.refetch()} />
                  ) : versions.isPending ? (
                    <LoadingState />
                  ) : (
                    <PluginVersionComparison pluginKey={props.pluginKey} versions={versions.data || []} selectedVersion={version} />
                  )}
                </>
              )}
              {version && tab !== 'sandbox' && tab !== 'compare' && (
                <Button variant="outline" onClick={() => setVersion('')}>
                  {t('Current saved version')}
                </Button>
              )}
              {tab === 'sandbox' && <PluginSandbox pluginKey={props.pluginKey} />}
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
