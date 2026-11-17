'use client'
import { catalogGroupLabel } from './group-label'

import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, buttonVariants } from '@/components/ui/button'
import type { Offering } from '@/lib/api/types'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { useModelPerformance } from '@/features/performance/use-performance'
import { SuccessHistory } from '@/features/performance/success-history'
import { PriceDisplay } from './model-card'
import { catalogOfferings, catalogRouteUsable, connectReturnPath, modelDetailHref } from './catalog-state'
import { quoteUnitLabel } from './price-format'
import { VideoRouteTiers } from './video-route-tiers'
import { CopyButton } from '@/components/shared/copy-button'
import type { CatalogDisplayModel } from './video-billing'
import type { PricingModel } from '@/features/pricing/types'

type RouteListProps = {
  model: CatalogDisplayModel
  groups: string[]
  currency: 'CNY' | 'USD'
  groupRatios?: Record<string, number>
  pricingModels?: PricingModel[]
  exchangeRate?: number
}

function CatalogRouteRow({
  model,
  currency,
  groupRatios,
  pricingModels,
  exchangeRate,
  route,
  label,
}: Omit<RouteListProps, 'groups'> & { route: Offering; label?: string }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const performance = useModelPerformance(route.invocation_id)

  const metric = performance.isError ? undefined : performance.data?.groups.find((item) => item.group === route.name)
  const unavailable = t(performance.isPending ? 'Loading' : performance.isError ? 'Performance unavailable' : 'No measurements yet')
  let status: 'good' | 'warning' | 'poor' | undefined
  if (metric) {
    if (metric.success_rate >= 90) status = 'good'
    else if (metric.success_rate >= 60) status = 'warning'
    else status = 'poor'
  }
  return (
    <article className="catalog-route-grid" key={route.offering_key}>
      <div className="catalog-route-identity">
        <Link href={modelDetailHref(model.configured_model_id, model.model_key, route.name, currency, model.videoBillingMode, route.offering_key)}>
          {route.catalog_label || label || catalogGroupLabel(route.name, t, route.public_description)}
        </Link>
        <div className="model-id">
          <code>{route.invocation_id}</code>
          <CopyButton value={route.invocation_id} />
        </div>
        {route.catalog_description && <p className="small-note">{route.catalog_description}</p>}
        <small className="catalog-route-protocol">
          {t('Protocol')}: {[...new Set(route.access.flatMap((access) => access.protocols))].join(', ') || '—'}
        </small>
      </div>
      <div className="catalog-route-price">
        <PriceDisplay
          quote={route.prices[0]}
          pricing={pricingModels?.find((item) => item.model_name === route.invocation_id)}
          groupRatio={groupRatios?.[route.name]}
          exchangeRate={exchangeRate}
        />
        <small className="small-note">{t(quoteUnitLabel(route.prices[0]))}</small>
      </div>
      <div className="catalog-route-metrics">
        <dl>
          <dt className="sr-only">{t('Success rate')}</dt>
          <dd className="catalog-route-success" data-status={status}>
            {metric ? (
              <>
                <SuccessHistory points={metric.series} />
                <strong>{formatNumber(metric.success_rate, locale)}%</strong>
              </>
            ) : (
              <span>
                {unavailable}
                {performance.isError && (
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() => {
                      void performance.refetch()
                    }}
                  >
                    {t('Retry')}
                  </Button>
                )}
              </span>
            )}
          </dd>
        </dl>
        {metric && (metric.has_ttft !== false || metric.has_tps !== false) && (
          <dl className="catalog-route-measurements">
            {metric.has_ttft !== false && (
              <div>
                <dt>{t('Time to first token')}</dt>
                <dd>{formatNumber(metric.avg_ttft_ms, locale)} ms</dd>
              </div>
            )}
            {metric.has_tps !== false && (
              <div>
                <dt>{t('Output speed')}</dt>
                <dd>{formatNumber(metric.avg_tps, locale)} tokens/s</dd>
              </div>
            )}
          </dl>
        )}
      </div>
      <div className="catalog-route-actions">
        {catalogRouteUsable(route) ? (
          <>
            <Link
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'catalog-route-key' })}
              href={`/keys?create=1&group=${encodeURIComponent(route.name)}`}
            >
              <Plus size={12} aria-hidden="true" />
              {t('Create Key for this route')}
            </Link>
            <Link
              className="catalog-route-connect"
              href={connectReturnPath(route.invocation_id, route.name, route.catalog_model_key || model.model_key, route.offering_key, currency)}
            >
              {t('Quick connect')}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <span>{t('Unconfigured')}</span>
        )}
      </div>
    </article>
  )
}

export function CatalogRouteList(props: RouteListProps) {
  const { t } = useTranslation()

  return (
    <tr className="catalog-route-expanded">
      <td colSpan={7}>
        <div className="catalog-route-grid catalog-route-head" aria-hidden="true">
          <span>
            {t('Routes')} · {t('Model ID')}
          </span>
          <span>{t('Price')}</span>
          <span>{t('Success rate')}</span>
        </div>
        <div className="catalog-route-list">
          <VideoRouteTiers
            mode={props.model.videoBillingMode}
            groupByResolution={props.model.modality === 'video'}
            offerings={catalogOfferings(props.model, props.groups)}
            renderRoute={(route, label) => <CatalogRouteRow key={route.offering_key} {...props} route={route} label={label} />}
          />
        </div>
      </td>
    </tr>
  )
}
