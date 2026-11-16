'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { ContainerFields } from './container-fields'
import { DeploymentLogs } from './deployment-logs'
import { DeploymentQuote } from './deployment-quote'
import { deploymentPath, deploymentUpdatePayload, deploymentExtensionParameters } from './contracts'
import { blankContainer, type ContainerDraft, type Deployment, type DeploymentDetail, type DeploymentContainer, type DeploymentCost } from './types'
export type DeploymentDialogMode = 'detail' | 'edit' | 'rename' | 'extend'

function DeploymentEditor(props: { detail: DeploymentDetail; mode: DeploymentDialogMode; onSaved: () => void; onClose: () => void }) {
  const { t } = useTranslation(),
    config = props.detail.container_config
  const [name, setName] = useState(props.detail.deployment_name || ''),
    [hours, setHours] = useState('1'),
    [error, setError] = useState('')
  const [draft, setDraft] = useState<ContainerDraft>(() => ({
    ...blankContainer,
    image: config?.image_url || '',
    port: config?.traffic_port ? String(config.traffic_port) : '',
    env: config?.env_variables || {},
    entrypoint: config?.entrypoint || [],
  }))
  const [quote, setQuote] = useState<{ key: string; cost: DeploymentCost } | null>(null)
  let quoteKey = ''
  if (props.mode === 'extend')
    try {
      quoteKey = JSON.stringify(deploymentExtensionParameters(props.detail, hours))
    } catch {
      /* Provider details may omit the resource fields needed for a quote. */
    }
  const validQuote = quote?.key === quoteKey && quote.cost.estimation_valid
  const estimate = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const params = deploymentExtensionParameters(props.detail, hours)
      return { key: JSON.stringify(params), cost: await api<DeploymentCost>('/api/deployments/price-estimation', { method: 'POST', body: params }) }
    },
    onSuccess: setQuote,
    onError: (error) => setError(error.message),
  })
  const save = useMutation({
    gcTime: 0,
    mutationFn: () => {
      if (props.mode === 'rename') return api(deploymentPath(props.detail.id, '/name'), { method: 'PUT', body: { name: name.trim() } })
      if (props.mode === 'extend') return api(deploymentPath(props.detail.id, '/extend'), { method: 'POST', body: { duration_hours: Number(hours) } })
      return api(deploymentPath(props.detail.id), { method: 'PUT', body: deploymentUpdatePayload(draft) })
    },
    onSuccess: props.onSaved,
    onError: (error) => setError(error.message),
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      if (props.mode === 'extend' && !validQuote) throw new Error('Estimate the current resource selection before continuing')
      if (props.mode === 'edit') deploymentUpdatePayload(draft)
      save.mutate()
    } catch (error) {
      setError((error as Error).message)
    }
  }
  return (
    <form onSubmit={submit} autoComplete="off">
      <fieldset disabled={save.isPending}>
        {props.mode === 'rename' && (
          <label className="field">
            <span>{t('Deployment name')}</span>
            <Input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        )}
        {props.mode === 'edit' && (
          <ContainerFields updating value={draft} onChange={(value) => setDraft((previous) => ({ ...previous, ...value }))} />
        )}
        {props.mode === 'extend' && (
          <>
            <label className="field">
              <span>{t('Duration (hours)')}</span>
              <Input type="number" required min={1} step={1} value={hours} onChange={(event) => setHours(event.target.value)} />
            </label>
            <Button type="button" variant="outline" disabled={!quoteKey || estimate.isPending} onClick={() => estimate.mutate()}>
              {t('Estimate cost')}
            </Button>
            {validQuote && quote && <DeploymentQuote cost={quote.cost} />}
          </>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {t(error)}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={props.onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending || (props.mode === 'extend' && !validQuote)}>
            {t(props.mode === 'extend' ? 'Extend deployment' : 'Save')}
          </Button>
        </DialogFooter>
      </fieldset>
    </form>
  )
}
export function DeploymentDialog(props: { deployment: Deployment; mode: DeploymentDialogMode; onSaved: () => void; onClose: () => void }) {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    locale = toIntlLocale(i18n.language),
    [container, setContainer] = useState('')
  const detail = useQuery({
    queryKey: ['deployment-detail', bundle?.user.id, props.deployment.id],
    gcTime: 0,
    queryFn: ({ signal }) => api<DeploymentDetail>(deploymentPath(props.deployment.id), { signal }),
  })
  const containers = useQuery({
    queryKey: ['deployment-containers', bundle?.user.id, props.deployment.id],
    enabled: props.mode === 'detail',
    queryFn: ({ signal }) =>
      api<{ total: number; containers: DeploymentContainer[] }>(deploymentPath(props.deployment.id, '/containers'), { signal }),
  })
  const selected = useQuery({
    queryKey: ['deployment-container', bundle?.user.id, props.deployment.id, container],
    enabled: !!container,
    gcTime: 0,
    queryFn: ({ signal }) =>
      api<DeploymentContainer>(deploymentPath(props.deployment.id, `/containers/${encodeURIComponent(container)}`), { signal }),
  })
  const titles = { detail: 'Deployment details', edit: 'Update container configuration', rename: 'Rename deployment', extend: 'Extend deployment' }
  let containerContent
  if (containers.error) containerContent = <ErrorState error={containers.error} retry={() => containers.refetch()} />
  else if (containers.isPending) containerContent = <LoadingState />
  else if (!containers.data?.containers.length) containerContent = <EmptyState title={t('No containers')} />
  else
    containerContent = (
      <div className="deployment-containers">
        {containers.data.containers.map((row) => (
          <Button
            variant={container === row.container_id ? 'default' : 'outline'}
            key={row.container_id}
            onClick={() => setContainer(row.container_id)}
          >
            {row.container_id} · {row.status}
          </Button>
        ))}
      </div>
    )
  let content
  if (detail.error) content = <ErrorState error={detail.error} retry={() => detail.refetch()} />
  else if (detail.isPending) content = <LoadingState />
  else if (props.mode !== 'detail')
    content = (
      <DeploymentEditor
        key={props.mode}
        detail={{
          ...detail.data,
          deployment_name: props.deployment.deployment_name || props.deployment.container_name || detail.data.deployment_name,
        }}
        mode={props.mode}
        onSaved={props.onSaved}
        onClose={props.onClose}
      />
    )
  else
    content = (
      <div className="deployment-details">
        <dl>
          <dt>{t('Deployment ID')}</dt>
          <dd>
            <code>{detail.data.id}</code>
            <CopyButton value={detail.data.id} />
          </dd>
          <dt>{t('Status')}</dt>
          <dd>{detail.data.status}</dd>
          <dt>{t('Hardware')}</dt>
          <dd>
            {detail.data.brand_name} {detail.data.hardware_name}
          </dd>
          <dt>{t('GPUs per container')}</dt>
          <dd>{formatNumber(detail.data.gpus_per_container, locale)}</dd>
          <dt>{t('Replicas')}</dt>
          <dd>{formatNumber(detail.data.total_containers, locale)}</dd>
          <dt>{t('Remaining minutes')}</dt>
          <dd>{formatNumber(detail.data.compute_minutes_remaining, locale)}</dd>
        </dl>
        <h3>{t('Containers')}</h3>
        {containerContent}
        {selected.error && <ErrorState error={selected.error} retry={() => selected.refetch()} />}{' '}
        {selected.data && (
          <section>
            <h3>{selected.data.container_id}</h3>
            <dl>
              <dt>{t('Status')}</dt>
              <dd>{selected.data.status}</dd>
              <dt>{t('Uptime')}</dt>
              <dd>{formatNumber(selected.data.uptime_percent, locale)}%</dd>
              <dt>{t('Public URL')}</dt>
              <dd>
                <code>{selected.data.public_url || '—'}</code>
                {selected.data.public_url && <CopyButton value={selected.data.public_url} />}
              </dd>
            </dl>
            {selected.data.events?.map((event, index) => (
              <p key={`${event.time}:${index}`}>
                <time>{new Date(event.time * 1000).toLocaleString(locale)}</time> · {event.message}
              </p>
            ))}
            <DeploymentLogs key={container} id={props.deployment.id} container={container} />
          </section>
        )}
      </div>
    )
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className="deployment-dialog">
        <DialogHeader>
          <DialogTitle>{t(titles[props.mode])}</DialogTitle>
          <DialogDescription>{props.deployment.deployment_name || props.deployment.id}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
