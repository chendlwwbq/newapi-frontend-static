'use client'
import { catalogGroupLabel } from './group-label'
import { groupSeedanceModels, isSeedanceFamily, routeCatalogModel } from './seedance-families'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Catalog, CatalogModel, Offering } from '@/lib/api/types'
import { api, apiResponse } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { useModelPerformance } from '@/features/performance/use-performance'
import { SuccessHistory } from '@/features/performance/success-history'
import { useAuth, refreshSession } from '@/lib/auth/session'
import { CopyButton } from '@/components/shared/copy-button'
import { PriceDisplay, ProviderIcon } from './model-card'
import { ModelDocumentation } from '@/features/developer/published-documentation'
import { ApiReference } from '@/features/docs/api-reference'
import { apiProtocols, exampleRoute } from '@/features/docs/api-examples'
import { PriceBreakdown } from './price-breakdown'
import { VideoRouteTiers } from './video-route-tiers'
import { catalogVideoEntries, videoRouteSlot, type VideoBillingMode } from './video-billing'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { ModelPerformance } from '@/features/performance/model-performance'
import { ModuleAccessError } from './module-access-error'
import { CatalogNotices } from './catalog-notices'
import { catalogModelKey, catalogRouteUsable, connectReturnPath, modelDetailHref } from './catalog-state'
import type { PricingData, PricingModel } from '@/features/pricing/types'

export function ModelDetail({
  initial,
  modelId,
  routeModel,
  catalogKey,
  initialGroup,
  initialBilling,
  initialOffering,
}: {
  initial?: CatalogModel
  modelId?: string
  routeModel?: string
  catalogKey?: string
  initialGroup?: string
  initialBilling?: VideoBillingMode
  initialOffering?: string
}) {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    locale = toIntlLocale(i18n.language)
  const currency = 'CNY'
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(initialGroup),
    [collapsed, setCollapsed] = useState<string | null>(null)
  const [selectedOffering, setSelectedOffering] = useState(initialOffering)
  const [billing, setBilling] = useState(initialBilling)
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])
  useEffect(() => {
    setSelectedGroup(initialGroup)
    setSelectedOffering(initialOffering)
    setBilling(initialBilling)
    setCollapsed(null)
  }, [initialGroup, initialBilling, initialOffering, modelId])
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(window.location.search)
      setSelectedGroup(params.get('group') || undefined)
      setSelectedOffering(params.get('offering') || undefined)
      const mode = params.get('billing')
      setBilling(mode === 'second' || mode === 'request' ? mode : undefined)
      setCollapsed(null)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  function navigateGroup(value: string, offeringKey: string) {
    const params = new URLSearchParams(window.location.search)
    params.delete('currency')
    params.set('group', value)
    params.set('offering', offeringKey)
    window.history.pushState(null, '', `${window.location.pathname}${params.size ? '?' + params : ''}${window.location.hash}`)
  }
  const key = initial?.model_key || catalogKey || modelId || ''
  const keyType = initial?.model_key || catalogKey ? 'catalog_key' : 'model_id'
  const query = useQuery({
    queryKey: catalogModelKey(key, currency, auth.bundle, keyType),
    enabled: auth.phase === 'ready',
    queryFn: ({ signal }) =>
      api<Catalog>(
        isSeedanceFamily(key)
          ? `/api/catalog/models?currency=${currency}`
          : `/api/catalog/model?${new URLSearchParams({ key, key_type: keyType, currency })}`,
        { signal }
      ),
  })
  const pricingQuery = useQuery({
    queryKey: ['pricing', auth.bundle?.user.id || 0, auth.bundle?.user.group || '', auth.bundle?.session.sid || 'public'],
    enabled: auth.phase === 'ready',
    queryFn: async () => (await apiResponse<PricingModel[]>('/api/pricing')) as PricingData,
    staleTime: 30_000,
  })
  const canonical = isSeedanceFamily(key)
    ? groupSeedanceModels(query.data?.models || [], t).find((item) => item.model_key === key)
    : query.data?.model || (!auth.bundle ? initial : undefined)
  const entries = canonical ? catalogVideoEntries(canonical, t) : []
  const selectedRoute = canonical?.offerings.find((offering) =>
    selectedOffering ? offering.offering_key === selectedOffering : offering.name === selectedGroup
  )
  const selectedMode = billing ?? (selectedRoute && videoRouteSlot(selectedRoute)?.mode)
  const model = entries.find((entry) => entry.videoBillingMode === selectedMode) ?? entries[0]
  let selected: Offering | undefined
  if (selectedOffering)
    selected = model?.offerings.find((offering) => offering.offering_key === selectedOffering && (!selectedGroup || offering.name === selectedGroup))
  else if (selectedGroup) selected = model?.offerings.find((offering) => offering.name === selectedGroup)
  else selected = model?.offerings.find(catalogRouteUsable) ?? model?.offerings[0]
  const selectedModel = model && selected ? routeCatalogModel(model, selected) : model
  const performance = useModelPerformance(selected?.invocation_id || canonical?.configured_model_id || '')
  if (auth.phase === 'error')
    return (
      <main className="page-container" id="content">
        <ErrorState
          error={new Error(auth.error || 'Session refresh failed')}
          retry={() => {
            void refreshSession().catch((error) => toast.error(t(error.message)))
          }}
        />
      </main>
    )
  if (query.error)
    return (
      <main className="page-container" id="content">
        <ModuleAccessError
          error={query.error}
          retry={() => query.refetch()}
          returnTo={modelDetailHref(routeModel || modelId || '', catalogKey, selectedGroup, currency, billing, selectedOffering)}
        />
      </main>
    )
  if (!model)
    return (
      <main className="page-container" id="content">
        {query.isPending ? <LoadingState /> : <EmptyState title={t('Model not found')} />}
      </main>
    )
  const isVideo = model.modality === 'video'
  const metrics = isVideo ? (['success_rate', 'avg_latency_ms'] as const) : (['success_rate', 'avg_tps', 'avg_latency_ms', 'avg_ttft_ms'] as const)
  const protocols = selected ? exampleRoute(selectedModel, selected).protocols : new Set<string>()
  function renderRoute(offering: Offering, label?: string) {
    const metric =
      performance.isError || offering.invocation_id !== selected?.invocation_id
        ? undefined
        : performance.data?.groups.find((row) => row.group === offering.name)
    return (
      <details
        key={offering.offering_key}
        className="route-card"
        open={selected?.offering_key === offering.offering_key && collapsed !== offering.offering_key}
      >
        <summary
          onClick={(e) => {
            e.preventDefault()
            if (selected?.offering_key === offering.offering_key && collapsed !== offering.offering_key) setCollapsed(offering.offering_key)
            else {
              if (selected?.offering_key !== offering.offering_key) {
                setSelectedGroup(offering.name)
                setSelectedOffering(offering.offering_key)
                navigateGroup(offering.name, offering.offering_key)
              }
              setCollapsed(null)
            }
          }}
        >
          <strong>{offering.catalog_label || label || catalogGroupLabel(offering.name, t, offering.public_description)}</strong>
          <PriceDisplay
            quote={offering.prices[0]}
            groupRatio={pricingQuery.data?.group_ratio[offering.name]}
            exchangeRate={query.data?.fx ? Number(query.data.fx.cny_per_usd) : undefined}
          />
          <ChevronDown size={15} />
        </summary>
        <div className="route-card-body">
          <div className="model-id">
            <code>{offering.invocation_id}</code>
            <CopyButton value={offering.invocation_id} />
          </div>
          {offering.catalog_description && <p>{offering.catalog_description}</p>}
          {offering.public_description && <p>{offering.public_description}</p>}
          <div className={`detail-metrics${isVideo ? ' video-metrics' : ''}`}>
            {metrics.map((key) => (
              <div key={key}>
                <small>
                  {t(
                    { success_rate: 'Success rate', avg_tps: 'Output speed', avg_latency_ms: 'Average latency', avg_ttft_ms: 'Time to first token' }[
                      key
                    ]
                  )}
                </small>
                <strong>
                  {metric && !(key === 'avg_ttft_ms' && metric.has_ttft === false) && !(key === 'avg_tps' && metric.has_tps === false)
                    ? `${formatNumber(metric[key], locale)} ${{ success_rate: '%', avg_tps: 'tokens/s', avg_latency_ms: 'ms', avg_ttft_ms: 'ms' }[key]}`
                    : t(performance.isError ? 'Performance unavailable' : 'No measurements yet')}
                </strong>
              </div>
            ))}
          </div>
          {metric && <SuccessHistory points={metric.series} />}
          <p className="small-note">{t('Observed route performance over the last 24 hours.')}</p>
          <h3>{t('Price')}</h3>
          <PriceBreakdown
            quote={offering.prices[0]}
            pricing={pricingQuery.data?.data.find((item) => item.model_name === offering.invocation_id)}
            groupRatio={pricingQuery.data?.group_ratio[offering.name]}
            exchangeRate={query.data?.fx ? Number(query.data.fx.cny_per_usd) : undefined}
          />
        </div>
      </details>
    )
  }
  return (
    <main className="page-container model-detail-page" id="content">
      <div className="breadcrumb">
        <Link href="/pricing">← {t('Model catalog')}</Link>
        <span>/</span>
        <span>{model.name}</span>
      </div>
      <div className="model-detail-header">
        <ProviderIcon provider={model.provider} modelName={model.configured_model_id} icon={model.icon} size={48} />
        <div>
          <h1>{model.name}</h1>
          <p>
            {model.provider} · {model.offerings_count} {t('Routes')}
          </p>
        </div>
        {origin && (
          <CopyButton
            label={t('Copy link')}
            value={`${origin}${modelDetailHref(model.configured_model_id, model.model_key, selected?.name || selectedGroup, currency, model.videoBillingMode, selected?.offering_key || selectedOffering)}`}
          />
        )}
      </div>
      <p className="page-description">{model.description || t('No description yet')}</p>
      <CatalogNotices models={[model]} />
      <ModelDocumentation key={selected?.offering_key} model={selected?.invocation_id || model.configured_model_id} />
      <div className="detail-layout">
        <div className="detail-main">
          <section aria-labelledby="model-routes-heading">
            {pricingQuery.error && <ErrorState error={pricingQuery.error} retry={() => pricingQuery.refetch()} />}
            <div className="page-heading">
              <h2 id="model-routes-heading">
                {t('All routes')} <span className="muted">{model.offerings_count}</span>
              </h2>
            </div>
            <VideoRouteTiers
              mode={model.videoBillingMode}
              groupByResolution={model.modality === 'video'}
              offerings={model.offerings}
              renderRoute={renderRoute}
            />
          </section>
          {selected && (
            <div id="model-request-examples" className="detail-examples">
              <ApiReference key={selected.offering_key} initialModel={selectedModel} offering={selected} currency={currency} embedded />
            </div>
          )}
        </div>
        <aside className="detail-sidebar">
          <span className="small-note">{t('Routes')}</span>
          <h3>{selected ? selected.catalog_label || catalogGroupLabel(selected.name, t, selected.public_description) : '—'}</h3>
          {!selected && selectedGroup && <p className="small-note">{t('Selected group is unavailable.')}</p>}
          {selected && (
            <a className="pill-button secondary detail-example-link" href="#model-request-examples">
              {t('Request examples')}
              <ArrowRight size={14} />
            </a>
          )}
          {selected && catalogRouteUsable(selected) && (
            <>
              <Link
                className="pill-button"
                href={connectReturnPath(
                  selected.invocation_id,
                  selected.name,
                  selected.catalog_model_key || model.model_key,
                  selected.offering_key,
                  currency
                )}
              >
                {t('Quick connect')}
                <ArrowRight size={14} />
              </Link>
              <Link className="pill-button secondary" href={`/keys?create=1&group=${encodeURIComponent(selected.name)}`}>
                {t('Create Key for this route')}
              </Link>
            </>
          )}
          <dl>
            <dt>{t('Model ID')}</dt>
            <dd className="model-id">
              <code>{selected?.invocation_id || model.configured_model_id}</code>
              <CopyButton value={selected?.invocation_id || model.configured_model_id} />
            </dd>
            {!isVideo && (
              <>
                <dt>{t('Context length')}</dt>
                <dd>{formatNumber(model.context_window, locale)}</dd>
                <dt>{t('Output')}</dt>
                <dd>{formatNumber(model.max_output_tokens, locale)}</dd>
              </>
            )}
            <dt>{t('API reference')}</dt>
            <dd>{[...protocols].map((protocol) => t(apiProtocols.find((item) => item.id === protocol)?.label || protocol)).join(', ') || '—'}</dd>
          </dl>
        </aside>
      </div>
      <ModelPerformance key={selected?.invocation_id || model.configured_model_id} model={selected?.invocation_id || model.configured_model_id} />
    </main>
  )
}
