'use client'
import { catalogGroupLabel } from './group-label'
import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, ChevronDown, X, SlidersHorizontal, ArrowLeft, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, apiResponse } from '@/lib/api/client'
import { useAuth, refreshSession } from '@/lib/auth/session'
import { formatNumber, formatCompactNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import type { Catalog, CatalogModel } from '@/lib/api/types'
import { PriceDisplay, ProviderIcon, modelHref } from './model-card'
import { quoteUnitLabel } from './price-format'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog'
import { usePerformanceOverview } from '@/features/performance/use-performance'
import { SuccessHistory } from '@/features/performance/success-history'
import { ModuleAccessError } from './module-access-error'
import { CatalogNotices } from './catalog-notices'
import { CatalogSkill } from './catalog-skill'
import { CatalogPerformanceBadge } from './performance-badge'
import { CatalogRouteList } from './catalog-route-list'
import { catalogDisplayKey, catalogVideoEntries } from './video-billing'
import { groupSeedanceModels, isSeedanceFamily } from './seedance-families'
import type { PricingData, PricingModel } from '@/features/pricing/types'
import {
  readCatalogFilters,
  catalogFilterQuery,
  catalogListKey,
  catalogOfferings,
  catalogQuote,
  catalogQuoteSummary,
  filterCatalog,
  toggleCatalogComparison,
  UNKNOWN_PROVIDER,
} from './catalog-state'

const modalities = [
  ['all', 'All'],
  ['text', 'Text'],
  ['image', 'Image'],
  ['video', 'Video'],
  ['audio', 'Audio'],
  ['embedding', 'Embedding'],
]
const pageSize = 50
type CatalogUsage = { enabled: boolean; models: { model_name: string; requests: number; tokens: number }[] }
export function CatalogPage({ initial }: { initial: Catalog | null }) {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    params = useSearchParams(),
    locale = toIntlLocale(i18n.language)
  const filterQuery = params.toString()
  const filters = useMemo(() => readCatalogFilters(filterQuery), [filterQuery])
  const [searchInput, setSearchInput] = useState(filters.q)
  const [syncedQuery, setSyncedQuery] = useState(filters.q)
  if (syncedQuery !== filters.q) {
    setSyncedQuery(filters.q)
    setSearchInput(filters.q)
  }
  const deferredFilters = useDeferredValue({ ...filters, q: searchInput })
  const [compared, setCompared] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showAllProviders, setShowAllProviders] = useState(false)
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const query = useQuery({
    queryKey: catalogListKey(filters.currency, auth.bundle),
    enabled: auth.phase === 'ready',
    queryFn: ({ signal }) => api<Catalog>(`/api/catalog/models?currency=${filters.currency}`, { signal }),
    initialData: !auth.bundle && initial?.currency === filters.currency ? initial : undefined,
  })
  const pricingQuery = useQuery({
    queryKey: ['pricing', auth.bundle?.user.id || 0, auth.bundle?.user.group || '', auth.bundle?.session.sid || 'public'],
    enabled: auth.phase === 'ready',
    queryFn: async () => (await apiResponse<PricingModel[]>('/api/pricing')) as PricingData,
    staleTime: 30_000,
  })
  const performance = usePerformanceOverview(24, filters.groups)
  const usage = useQuery({
    queryKey: [
      'catalog-usage',
      auth.bundle?.user.id || 0,
      auth.bundle?.user.group || '',
      auth.bundle?.session.sid || 'public',
      [...filters.groups].sort(),
    ],
    enabled: auth.phase === 'ready',
    queryFn: ({ signal }) => {
      const params = new URLSearchParams()
      for (const group of filters.groups) params.append('group', group)
      return api<CatalogUsage>(`/api/catalog/usage${params.size ? '?' + params : ''}`, {
        signal,
      })
    },
    staleTime: 60_000,
  })
  const usageByModel = useMemo(
    () => new Map(usage.isError ? [] : (usage.data?.models || []).map((row) => [row.model_name, row])),
    [usage.data, usage.isError]
  )
  const rawModels = auth.phase === 'error' || query.error ? undefined : query.data?.models
  const models = useMemo(() => rawModels && groupSeedanceModels(rawModels, t).flatMap((model) => catalogVideoEntries(model, t)), [rawModels, t])
  const metrics = useMemo(
    () => new Map(performance.isError ? [] : performance.data?.models.map((row) => [row.model_name, row])),
    [performance.data, performance.isError]
  )
  const catalogStatus =
    auth.phase === 'error' ? (
      <ErrorState
        error={new Error(auth.error || 'Session refresh failed')}
        retry={() => {
          void refreshSession().catch((error) => toast.error(t(error.message)))
        }}
      />
    ) : query.error ? (
      <ModuleAccessError error={query.error} retry={() => query.refetch()} />
    ) : null
  const facets = useMemo(() => {
    const providers = new Map<string, number>()
    const groups = new Map<string, number>()
    const groupDescriptions = new Map<string, string>()
    const counts = new Map<string, number>()
    for (const model of models || []) {
      const provider = model.provider || UNKNOWN_PROVIDER
      providers.set(provider, (providers.get(provider) || 0) + 1)
      counts.set(model.modality, (counts.get(model.modality) || 0) + 1)
      for (const route of model.offerings)
        if (route.public_description && !groupDescriptions.has(route.name)) groupDescriptions.set(route.name, route.public_description)
      for (const group of new Set(model.offerings.map((row) => row.name))) groups.set(group, (groups.get(group) || 0) + 1)
    }
    return {
      providers: [...providers].sort(([a], [b]) => a.localeCompare(b)),
      groups: [...groups].sort(([a], [b]) => a.localeCompare(b)),
      groupDescriptions,
      counts,
    }
  }, [models])
  const filtered = useMemo(() => filterCatalog(models || [], deferredFilters, metrics), [models, deferredFilters, metrics])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(filters.page, pageCount)
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const selections = (models || []).filter((model) => compared.includes(catalogDisplayKey(model)))
  const active = !!(searchInput || filters.providers.length || filters.groups.length || filters.inputs?.length || filters.modality !== 'all')
  function update(key: string, values: string | string[], replace = false) {
    const query = catalogFilterQuery(window.location.search, key, values)
    const url = `/pricing${query ? '?' + query : ''}`
    if (replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
  }
  function toggleFacet(key: 'provider' | 'group', name: string) {
    const selected = filters[key === 'provider' ? 'providers' : 'groups']
    update(key, selected.includes(name) ? selected.filter((value) => value !== name) : [...selected, name])
  }
  function toggle(model: CatalogModel) {
    const next = toggleCatalogComparison(compared, catalogDisplayKey(model), models || [])
    if (next) setCompared(next)
    else toast.info(t('Compare up to four models'))
  }
  function toggleRoutes(key: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function reset() {
    setSearchInput('')
    window.history.pushState(null, '', '/pricing')
  }
  const comparisonRows: [string, (model: CatalogModel) => string | number][] = [
    ['Provider', (model) => model.provider],
    ['Context length', (model) => formatNumber(model.context_window, locale)],
    ['Output', (model) => formatNumber(model.max_output_tokens, locale)],
    ['Routes', (model) => catalogOfferings(model, filters.groups).length],
    ['Capabilities', (model) => model.capabilities.map((value) => t(value)).join(', ') || '—'],
    [
      'API reference',
      (model) =>
        [...new Set(catalogOfferings(model, filters.groups).flatMap((row) => row.access.flatMap((access) => access.protocols)))].join(', ') || '—',
    ],
    [
      'Success rate',
      (model) =>
        !isSeedanceFamily(model.model_key) && metrics.has(model.configured_model_id)
          ? `${formatNumber(metrics.get(model.configured_model_id)!.success_rate, locale)}%`
          : '—',
    ],
    [
      'Output speed',
      (model) =>
        !isSeedanceFamily(model.model_key) && metrics.has(model.configured_model_id) && metrics.get(model.configured_model_id)?.has_tps !== false
          ? `${formatNumber(metrics.get(model.configured_model_id)!.avg_tps, locale)} tokens/s`
          : '—',
    ],
    [
      'Average latency',
      (model) =>
        !isSeedanceFamily(model.model_key) && metrics.has(model.configured_model_id)
          ? `${formatNumber(metrics.get(model.configured_model_id)!.avg_latency_ms, locale)} ms`
          : '—',
    ],
  ]
  return (
    <main className="page-container catalog-page" id="content">
      <div className="page-heading">
        <div>
          <h1 className="page-title text-3xl font-bold tracking-tight">{t('Model catalog')}</h1>
          <p className="page-description text-sm text-muted-foreground">{t('Compare models, prices and routes in one place.')}</p>
        </div>
        <div className="catalog-heading-actions">
          <CatalogPerformanceBadge
            filtered={!!filters.groups.length}
            successRate={performance.isError ? null : (performance.data?.summary?.success_rate ?? null)}
          />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2" aria-label={t('Billing modes')}>
        <Link
          href="/wallet?tab=recharge"
          className="group flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm transition-all hover:border-purple-500/40 hover:shadow-md"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t('Pay-as-you-go')}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t('Recharge')}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('Top up account balance and pay per request based on model rates.')}</p>
          </div>
          <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/wallet?tab=subscriptions"
          className="group flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm transition-all hover:border-purple-500/40 hover:shadow-md"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t('Subscriptions')}</span>
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-300">
                {t('Quota plan')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t('Fixed periodic quota allowances with dedicated subscription billing.')}</p>
          </div>
          <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <CatalogSkill />
      {!catalogStatus && models && <CatalogNotices models={filtered} groups={filters.groups} />}
      <div className="catalog-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            type="search"
            aria-label={t('Search models')}
            placeholder={t('Search models')}
            value={searchInput}
            onChange={(event) => {
              const value = event.target.value
              setSearchInput(value)
              update('q', value, true)
            }}
          />
        </label>
        <FilterSelect
          className="catalog-sort-select"
          label={t('Sort')}
          hideLabel
          value={filters.sort}
          onChange={(value) => update('sort', value)}
          options={[
            { value: 'name', label: t('Name') },
            { value: 'price', label: t('Price') },
            { value: 'success', label: t('Success rate') },
            { value: 'speed', label: t('Output speed') },
          ]}
        />
      </div>
      <div className="category-tabs">
        {modalities.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={filters.modality === id}
            data-active={filters.modality === id}
            onClick={() => update('modality', id)}
          >
            {t(label)} <small>{id === 'all' ? models?.length || 0 : facets.counts.get(id) || 0}</small>
          </button>
        ))}
      </div>
      <Button
        variant="outline"
        className="catalog-filter-toggle"
        aria-expanded={filtersOpen}
        aria-controls="catalog-filters"
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <SlidersHorizontal size={15} />
        {t('Filters')}{' '}
        {!!(filters.providers.length + filters.groups.length + (filters.inputs?.length || 0)) && (
          <span>{filters.providers.length + filters.groups.length + (filters.inputs?.length || 0)}</span>
        )}
      </Button>
      <div className="catalog-layout">
        <aside id="catalog-filters" className={`catalog-filters ${filtersOpen ? 'is-open' : ''}`} aria-label={t('Filters')}>
          <div className="catalog-filter-heading">
            <strong>{t('Filters')}</strong>
            {active && (
              <button className="text-link" onClick={reset}>
                {t('Reset filters')}
              </button>
            )}
          </div>
          <FilterSelect
            className="catalog-route-select"
            label={t('Routes')}
            hideLabel
            value={filters.groups.length > 1 ? '__multiple__' : filters.groups[0] || ''}
            onChange={(value) => update('group', value)}
            options={[
              { value: '', label: t('All groups') },
              ...(filters.groups.length > 1 ? [{ value: '__multiple__', label: `${t('Routes')} · ${filters.groups.length}`, disabled: true }] : []),
              ...facets.groups.map(([name]) => ({ value: name, label: catalogGroupLabel(name, t, facets.groupDescriptions.get(name)) })),
            ]}
          />
          <details className="catalog-filter-section" open>
            <summary>
              {t('Provider')}
              <ChevronDown size={14} />
            </summary>
            <fieldset aria-label={t('Provider')}>
              {facets.providers
                .filter(([name], index) => showAllProviders || index < 8 || filters.providers.includes(name))
                .map(([name, count]) => (
                  <label key={name}>
                    <input type="checkbox" checked={filters.providers.includes(name)} onChange={() => toggleFacet('provider', name)} />
                    <span className="catalog-provider-name">
                      <span aria-hidden="true">
                        <ProviderIcon provider={name} size={18} />
                      </span>
                      <span>{name === UNKNOWN_PROVIDER ? t('Unknown') : name}</span>
                    </span>
                    <small>{count}</small>
                  </label>
                ))}
              {facets.providers.length > 8 && (
                <button
                  type="button"
                  className="catalog-filter-more"
                  aria-expanded={showAllProviders}
                  onClick={() => setShowAllProviders(!showAllProviders)}
                >
                  {t(showAllProviders ? 'Collapse' : 'Show all')} {!showAllProviders && facets.providers.length}
                </button>
              )}
            </fieldset>
          </details>
          <details className="catalog-filter-section" open>
            <summary>
              {t('Routes')}
              <ChevronDown size={14} />
            </summary>
            <fieldset aria-label={t('Routes')}>
              {facets.groups
                .filter(([name], index) => showAllGroups || index < 6 || filters.groups.includes(name))
                .map(([name, count]) => (
                  <label key={name}>
                    <input type="checkbox" checked={filters.groups.includes(name)} onChange={() => toggleFacet('group', name)} />
                    <span>{catalogGroupLabel(name, t, facets.groupDescriptions.get(name))}</span>
                    <small>{count}</small>
                  </label>
                ))}
              {facets.groups.length > 6 && (
                <button type="button" className="catalog-filter-more" aria-expanded={showAllGroups} onClick={() => setShowAllGroups(!showAllGroups)}>
                  {t(showAllGroups ? 'Collapse' : 'Show all')} {!showAllGroups && facets.groups.length}
                </button>
              )}
            </fieldset>
          </details>
          <details className="catalog-filter-section" open>
            <summary>
              {t('Input modality')}
              <ChevronDown size={14} />
            </summary>
            <fieldset aria-label={t('Input modality')}>
              {modalities
                .filter(([id]) => ['text', 'image', 'video', 'audio'].includes(id))
                .map(([id, label]) => {
                  const selected = filters.inputs || []
                  const count = (models || []).filter((model) => (model.input_modalities || []).includes(id)).length
                  return (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(id)}
                        onChange={() => update('input', selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id])}
                      />
                      <span>{t(label)}</span>
                      <small>{count}</small>
                    </label>
                  )
                })}
            </fieldset>
          </details>
        </aside>
        <section className="catalog-results" aria-label={t('Models')}>
          {catalogStatus}
          {!catalogStatus && query.isPending && <LoadingState />}
          {!catalogStatus && !query.isPending && (
            <>
              <div className="catalog-result-heading">
                <p className="catalog-count" aria-live="polite">
                  {filtered.length} {t('Models')} · {filtered.reduce((sum, model) => sum + catalogOfferings(model, filters.groups).length, 0)}{' '}
                  {t('Routes')}
                </p>
                {active && (
                  <button className="text-link" onClick={reset}>
                    {t('Reset filters')}
                    <X size={12} />
                  </button>
                )}
              </div>
              {filters.sort === 'price' && <p className="small-note">{t('Prices are sorted within matching billing units and price types.')}</p>}
              <div className="catalog-active-filters">
                {filters.providers.map((name) => (
                  <button key={`provider:${name}`} onClick={() => toggleFacet('provider', name)}>
                    {name === UNKNOWN_PROVIDER ? t('Unknown') : name}
                    <X size={11} />
                  </button>
                ))}
                {filters.groups.map((name) => (
                  <button key={`group:${name}`} onClick={() => toggleFacet('group', name)}>
                    {catalogGroupLabel(name, t, facets.groupDescriptions.get(name))}
                    <X size={11} />
                  </button>
                ))}
                {filters.inputs?.map((id) => {
                  const label = modalities.find(([value]) => value === id)?.[1] || id
                  return (
                    <button
                      key={`input:${id}`}
                      onClick={() =>
                        update(
                          'input',
                          (filters.inputs || []).filter((value) => value !== id)
                        )
                      }
                    >
                      {t(label)}
                      <X size={11} />
                    </button>
                  )
                })}
              </div>
              {!!visible.length && (
                <div className="table-wrap catalog-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th aria-label={t('Compare')} />
                        <th>{t('Model')}</th>
                        <th>
                          {t('Price')}
                          <small>{t('Price')}</small>
                        </th>
                        <th>{t('Success rate')}</th>
                        <th>{t('Performance')}</th>
                        <th>{t('Usage (7 days)')}</th>
                        <th>{t('Routes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((model) => {
                        const family = isSeedanceFamily(model.model_key),
                          metric = family ? undefined : metrics.get(model.configured_model_id),
                          usageRow = family ? undefined : usageByModel.get(model.configured_model_id),
                          summary = catalogQuoteSummary(model, filters.groups),
                          quote = summary?.quote,
                          route = model.offerings.find((item) => item.offering_key === summary?.offering_key)
                        let routeStatus = 'unknown'
                        if (metric) {
                          if (metric.success_rate >= 90) routeStatus = 'good'
                          else if (metric.success_rate >= 60) routeStatus = 'warning'
                          else routeStatus = 'poor'
                        }
                        return (
                          <Fragment key={catalogDisplayKey(model)}>
                            <tr className={`model-row${expanded.has(catalogDisplayKey(model)) ? ' is-expanded' : ''}`}>
                              <td>
                                <label className="catalog-compare-toggle">
                                  <input
                                    type="checkbox"
                                    checked={compared.includes(catalogDisplayKey(model))}
                                    onChange={() => toggle(model)}
                                    aria-label={`${t('Compare')} ${model.name}`}
                                  />
                                </label>
                              </td>
                              <td>
                                <Link className="model-table-name" href={modelHref(model, filters.groups, filters.currency)}>
                                  <ProviderIcon provider={model.provider} modelName={model.configured_model_id} icon={model.icon} size={30} />
                                  <div>
                                    <strong>{model.name}</strong>
                                    {family ? (
                                      <small>{t('Choose a route')}</small>
                                    ) : (
                                      <code title={model.configured_model_id}>{model.configured_model_id}</code>
                                    )}
                                  </div>
                                </Link>
                              </td>
                              <td>
                                {family ? (
                                  <span>{t('View route prices')}</span>
                                ) : (
                                  <>
                                    <PriceDisplay
                                      quote={quote}
                                      pricing={pricingQuery.data?.data.find(
                                        (item) => item.model_name === (route?.invocation_id || model.configured_model_id)
                                      )}
                                      groupRatio={quote ? pricingQuery.data?.group_ratio[quote.group] : undefined}
                                      exchangeRate={query.data?.fx ? Number(query.data.fx.cny_per_usd) : undefined}
                                    />
                                    <small className="small-note">
                                      {t(quoteUnitLabel(quote))}
                                      {route && (
                                        <>
                                          {' '}
                                          · {t('Group')}: {catalogGroupLabel(route.name, t, route.public_description)}
                                        </>
                                      )}
                                    </small>
                                  </>
                                )}
                              </td>
                              <td>
                                {family ? (
                                  <span className="small-note">{t('View individual routes')}</span>
                                ) : metric ? (
                                  <>
                                    <strong className="catalog-success" data-status={routeStatus}>
                                      {formatNumber(metric.success_rate, locale)}%
                                    </strong>
                                    <SuccessHistory points={metric.recent_success_series || []} />
                                  </>
                                ) : (
                                  <span className="small-note">{t(performance.isError ? 'Performance unavailable' : 'No measurements yet')}</span>
                                )}
                              </td>
                              <td>
                                {metric ? (
                                  <>
                                    <span>
                                      {metric.has_tps === false ? (
                                        t('No measurements yet')
                                      ) : (
                                        <>
                                          {formatNumber(metric.avg_tps, locale)} <small className="small-note">tokens/s</small>
                                        </>
                                      )}
                                    </span>
                                    <small className="small-note">{formatNumber(metric.avg_latency_ms, locale)} ms</small>
                                  </>
                                ) : (
                                  <span className="small-note">—</span>
                                )}
                              </td>
                              <td>
                                {family ? (
                                  <span className="small-note">—</span>
                                ) : usageRow ? (
                                  <>
                                    <strong>
                                      {formatCompactNumber(usageRow.requests, locale)} <small>{t('records')}</small>
                                    </strong>
                                    <small className="small-note">
                                      {formatCompactNumber(usageRow.tokens, locale)} {t('Tokens')}
                                    </small>
                                  </>
                                ) : (
                                  <span className="small-note">
                                    {t(
                                      usage.isError
                                        ? 'Something went wrong'
                                        : usage.isPending
                                          ? 'Loading'
                                          : usage.data?.enabled === false
                                            ? 'Disabled'
                                            : 'No data yet'
                                    )}
                                  </span>
                                )}
                              </td>
                              <td>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="catalog-routes"
                                  aria-label={`${t('Routes')} ${model.name}`}
                                  aria-expanded={expanded.has(catalogDisplayKey(model))}
                                  onClick={() => toggleRoutes(catalogDisplayKey(model))}
                                >
                                  <span className="catalog-route-dot" aria-hidden="true" data-status={routeStatus} />
                                  <span>
                                    {catalogOfferings(model, filters.groups).length}
                                    <span className="catalog-route-count-label"> {t('Routes')}</span>
                                  </span>
                                  <ChevronDown size={12} />
                                </Button>
                              </td>
                            </tr>
                            {expanded.has(catalogDisplayKey(model)) && (
                              <CatalogRouteList
                                model={model}
                                groups={filters.groups}
                                currency={filters.currency}
                                groupRatios={pricingQuery.data?.group_ratio}
                                pricingModels={pricingQuery.data?.data}
                                exchangeRate={query.data?.fx ? Number(query.data.fx.cny_per_usd) : undefined}
                              />
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!visible.length && (
                <EmptyState
                  title={t(models?.length ? 'No matching models' : 'No models configured')}
                  description={t(
                    models?.length ? 'Try another search or clear your filters.' : 'Add a channel in the admin console to publish models.'
                  )}
                />
              )}
              <p className="small-note catalog-measurement-note">
                {t(
                  filters.groups.length
                    ? 'Last 24 hours across selected groups. Only observed samples are shown.'
                    : 'Last 24 hours across all active groups. Only observed samples are shown.'
                )}
                {performance.isError && (
                  <button className="text-link" onClick={() => performance.refetch()}>
                    {t('Retry')}
                  </button>
                )}
              </p>
              <p className="small-note catalog-measurement-note">
                {t(
                  'Last 7 days of hourly consumption records. Failed requests may be excluded, task token totals may be incomplete, and data may be delayed.'
                )}
                {usage.isError && (
                  <button className="text-link" onClick={() => usage.refetch()}>
                    {t('Retry')}
                  </button>
                )}
              </p>
              {pageCount > 1 && (
                <div className="catalog-pagination">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => update('page', String(page - 1))}>
                    <ArrowLeft size={14} />
                    {t('Previous')}
                  </Button>
                  <span>
                    {page} / {pageCount}
                  </span>
                  <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => update('page', String(page + 1))}>
                    {t('Next')}
                    <ArrowRight size={14} />
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      {!!selections.length && (
        <div className="compare-bar">
          <span>
            {t('Compare')} {selections.length}/4
          </span>
          <div className="comparison-names">
            {selections.map((model) => (
              <button key={catalogDisplayKey(model)} onClick={() => toggle(model)} aria-label={`${t('Remove')} ${model.name}`}>
                {model.name}
                <X size={12} />
              </button>
            ))}
          </div>
          <Button onClick={() => setCompareOpen(true)} disabled={!selections.length}>
            {t('Compare')}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setCompared([])} aria-label={t('Close')}>
            <X size={15} />
          </Button>
        </div>
      )}
      <Dialog open={compareOpen && !!selections.length} onOpenChange={setCompareOpen}>
        <DialogContent className="catalog-comparison">
          <DialogHeader>
            <DialogTitle>{t('Compare')}</DialogTitle>
          </DialogHeader>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Model')}</th>
                  {selections.map((model) => (
                    <th key={catalogDisplayKey(model)}>
                      <Link href={modelHref(model, filters.groups, filters.currency)}>{model.name} ↗</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([label, render]) => (
                  <tr key={label}>
                    <td>{t(label)}</td>
                    {selections.map((model) => (
                      <td key={catalogDisplayKey(model)}>{render(model)}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td>{t('Price')}</td>
                  {selections.map((model) => (
                    <td key={catalogDisplayKey(model)}>
                      <PriceDisplay
                        quote={catalogQuote(model, filters.groups)}
                        pricing={pricingQuery.data?.data.find((item) => item.model_name === model.configured_model_id)}
                        groupRatio={pricingQuery.data?.group_ratio[catalogQuote(model, filters.groups)?.group || '']}
                        exchangeRate={query.data?.fx ? Number(query.data.fx.cny_per_usd) : undefined}
                      />
                      <small className="small-note">{t(quoteUnitLabel(catalogQuote(model, filters.groups)))}</small>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="small-note">
            {t(
              filters.groups.length
                ? 'Last 24 hours across selected groups. Only observed samples are shown.'
                : 'Last 24 hours across all active groups. Only observed samples are shown.'
            )}
          </p>
        </DialogContent>
      </Dialog>
    </main>
  )
}
