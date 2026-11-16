'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import type { Catalog, CatalogModel, Offering } from '@/lib/api/types'
import { useAuth, refreshSession } from '@/lib/auth/session'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { ModuleAccessError } from '@/features/catalog/module-access-error'
import { catalogListKey, connectRoute, modelDetailHref } from '@/features/catalog/catalog-state'
import { apiExample, apiProtocols, endpointOnlyProtocols, exampleRoute, type ApiProtocol, type ExampleLanguage } from './api-examples'
import { useGatewayAddress } from './use-gateway-address'

export function ApiReference({
  modelPicker = false,
  initialModel,
  offering,
  currency,
  embedded = false,
}: {
  modelPicker?: boolean
  initialModel?: CatalogModel
  offering?: Offering
  currency?: 'CNY' | 'USD'
  embedded?: boolean
}) {
  const { t } = useTranslation(),
    auth = useAuth(),
    gateway = useGatewayAddress()
  const [modelId, setModelId] = useState(''),
    [routeId, setRouteId] = useState(''),
    [protocol, setProtocol] = useState<ApiProtocol | null>(null),
    [language, setLanguage] = useState<ExampleLanguage>('curl'),
    [stream, setStream] = useState(false)
  const catalog = useQuery({
    queryKey: catalogListKey('CNY', auth.bundle),
    enabled: modelPicker && auth.phase === 'ready',
    queryFn: ({ signal }) => api<Catalog>('/api/catalog/models?currency=CNY', { signal }),
  })
  const model = modelPicker ? catalog.data?.models.find((item) => item.model_key === modelId) || catalog.data?.models[0] : initialModel
  const selectedOffering = modelPicker ? connectRoute(model, undefined, routeId || undefined) : offering
  const scope = exampleRoute(modelPicker && !selectedOffering ? undefined : model, selectedOffering)
  const protocols = apiProtocols.filter((item) => !model || scope.protocols.has(item.id))
  const endpointOnly = endpointOnlyProtocols.filter((item) => scope.protocols.has(item.id))
  const selected =
    protocols.find((item) => item.id === protocol) ||
    protocols.find((item) => item.id === (model?.modality === 'video' ? 'openai-video' : 'openai')) ||
    protocols[0]
  if (gateway.error) return <ErrorState error={gateway.error} retry={gateway.retry} />
  if (modelPicker && auth.phase === 'error')
    return (
      <ErrorState
        error={new Error(auth.error || 'Session refresh failed')}
        retry={() => {
          void refreshSession().catch((error) => toast.error(t(error.message)))
        }}
      />
    )
  if (modelPicker && catalog.error) return <ModuleAccessError error={catalog.error} retry={() => catalog.refetch()} />
  if (!gateway.address || (modelPicker && catalog.isPending)) return <LoadingState />
  if (modelPicker && !model) return <EmptyState title={t('No models available')} />
  const code = selected ? apiExample(selected.id, gateway.address, scope.modelId, stream, language, selectedOffering) : ''
  const keySetup = language === 'powershell' ? "$env:NEW_API_KEY = 'YOUR_API_KEY'" : "export NEW_API_KEY='YOUR_API_KEY'"
  return (
    <section className="api-reference">
      <h2>{t('Request examples')}</h2>
      <p className="small-note">{t('Examples are not executed. Set NEW_API_KEY in your environment before running them.')}</p>
      {!embedded && model?.description && <p className="small-note">{model.description}</p>}
      <div className="api-reference-controls">
        {modelPicker && (
          <>
            <label className="field">
              <span>{t('Model')}</span>
              <select
                value={model?.model_key || ''}
                onChange={(event) => {
                  setModelId(event.target.value)
                  setRouteId('')
                }}
              >
                {catalog.data?.models.map((item) => (
                  <option value={item.model_key} key={item.model_key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('Route')}</span>
              <select
                value={selectedOffering?.offering_key || ''}
                disabled={!model?.offerings.length}
                onChange={(event) => setRouteId(event.target.value)}
              >
                {!selectedOffering && <option value="">{t(routeId ? 'Selected group is unavailable.' : 'No routes available')}</option>}
                {model?.offerings.map((route) => (
                  <option key={route.offering_key} value={route.offering_key}>
                    {route.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="field">
          <span>{t('Example language')}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as ExampleLanguage)}>
            <option value="curl">cURL · Bash</option>
            <option value="powershell">cURL · PowerShell 7</option>
            <option value="python">Python</option>
            <option value="javascript">Node.js</option>
          </select>
        </label>
      </div>
      {selected && (!modelPicker || selectedOffering) && (language === 'curl' || language === 'powershell') && (
        <>
          <p className="small-note">{t('Replace YOUR_API_KEY with your API key and run this command in the same terminal before the request.')}</p>
          <div className="code-preview">
            <div>
              <span>NEW_API_KEY</span>
              <CopyButton value={keySetup} />
            </div>
            <pre>{keySetup}</pre>
          </div>
        </>
      )}
      {modelPicker && !selectedOffering && <p className="small-note">{t(routeId ? 'Selected group is unavailable.' : 'No routes available')}</p>}
      {(!modelPicker || selectedOffering) &&
        (protocols.length ? (
          <>
            <div className="protocol-list" role="group" aria-label={t('Protocol')}>
              {protocols.map((item) => (
                <Button key={item.id} variant="outline" type="button" aria-pressed={selected?.id === item.id} onClick={() => setProtocol(item.id)}>
                  {t(item.label)}
                </Button>
              ))}
            </div>
            {selected?.stream && (
              <label className="checkbox-label" style={{ marginTop: 16 }}>
                <input type="checkbox" checked={stream} onChange={(event) => setStream(event.target.checked)} />
                {t('Stream')}
              </label>
            )}
            <div className="code-preview">
              <div>
                <span>
                  {language === 'javascript'
                    ? 'Node.js'
                    : language === 'python'
                      ? 'Python'
                      : language === 'powershell'
                        ? 'cURL · PowerShell 7'
                        : 'cURL · Bash'}
                </span>
                <CopyButton value={code} />
              </div>
              <pre>{code}</pre>
            </div>
          </>
        ) : (
          !endpointOnly.length && (
            <p className="small-note">
              {t('This model uses endpoint types without a built-in example. Check its model details and provider documentation.')}
            </p>
          )
        ))}
      {selected?.id === 'openai-video' && (
        <div className="small-note">
          <p>{t('Replace example.com reference URLs with publicly accessible media URLs before submitting.')}</p>
          <Link className="text-link" href="/docs/async-tasks">
            {t('Connect asynchronous tasks')} ↗
          </Link>
        </div>
      )}
      {model &&
        scope.routes.length > 0 &&
        endpointOnly.map((item) => (
          <div key={item.id}>
            <div className="code-preview">
              <div>
                <span>{t(item.label)}</span>
                <CopyButton value={`${gateway.address}${item.path}`} />
              </div>
              <pre>
                {gateway.address}
                {item.path}
              </pre>
            </div>
            <p className="small-note">
              {t('This model uses endpoint types without a built-in example. Check its model details and provider documentation.')}
            </p>
          </div>
        ))}
      {model && !embedded && (
        <p className="small-note">
          {t('Routes')}: {scope.routes.map((item) => item.name).join(', ')} ·{' '}
          <Link className="text-link" href={modelDetailHref(model.configured_model_id, model.model_key, selectedOffering?.name, currency)}>
            {t('Model details')}
          </Link>
        </p>
      )}
    </section>
  )
}
