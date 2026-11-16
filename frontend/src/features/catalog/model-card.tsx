'use client'
import { catalogGroupLabel } from './group-label'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import { toIntlLocale } from '@/i18n/languages'
import { formatPrice, quoteUnitLabel } from './price-format'
import { formatCompactNumber } from '@/lib/format'
import type { CatalogModel, Quote } from '@/lib/api/types'
import { catalogQuoteSummary, modelDetailHref } from './catalog-state'
import { parseVisualBillingDocument, type VisualPricingNode } from '@/features/pricing/lib/billing-expression/visual'
import { hasDeclaredUsageKeys, pricingExpressionParts } from '@/features/pricing/expression-parts'
import { parseTaskTiersFromExpr } from '@/features/pricing/lib/billing-expr'
import { videoBillingGroupSlot, type CatalogDisplayModel } from './video-billing'

function comparablePriceTiers(node: VisualPricingNode): Extract<VisualPricingNode, { kind: 'tier' }>[] {
  if (node.kind === 'tier') return [node]
  return [...comparablePriceTiers(node.yes), ...comparablePriceTiers(node.no)]
}

export function modelHref(model: CatalogDisplayModel, groups: string[] = [], currency?: 'CNY' | 'USD') {
  const quoted = catalogQuoteSummary(model, groups)
  const route =
    model.offerings.find((offering) => offering.offering_key === quoted?.offering_key) ||
    model.offerings.find((offering) => groups.includes(offering.name))
  return modelDetailHref(model.configured_model_id, model.model_key, route?.name, currency, model.videoBillingMode, route?.offering_key)
}
export function PriceDisplay({ quote, groupRatio, exchangeRate }: { quote?: Quote; groupRatio?: number; exchangeRate?: number }) {
  const { t, i18n } = useTranslation()
  if (quote?.status === 'unconfigured') return <span className="muted">{t('Unconfigured')}</span>
  if (quote?.pricing_source === 'channel' && quote.billing_expr && groupRatio !== undefined && Number.isFinite(groupRatio) && groupRatio >= 0) {
    const parts = pricingExpressionParts(quote.billing_expr)
    const schema = quote.billing_usage_schema
    const mode = videoBillingGroupSlot(quote.group)?.mode
    const field =
      mode === 'request' && schema?.videos?.unit === 'count'
        ? 'videos'
        : mode === 'second' && schema?.seconds?.unit === 'second'
          ? 'seconds'
          : schema?.tokens?.unit === 'token'
            ? 'tokens'
            : undefined
    const tiers =
      field && !parts.requestRuleExpr && hasDeclaredUsageKeys(parts.billingExpr, schema)
        ? parseTaskTiersFromExpr(parts.billingExpr, schema, true)
        : []
    const fx = quote.currency === 'USD' ? 1 : exchangeRate
    if (
      field &&
      tiers.length &&
      fx &&
      fx > 0 &&
      tiers.every(
        (tier) =>
          tier.constant === 0 && Object.keys(tier.unitPrices).length === 1 && Number.isFinite(tier.unitPrices[field]) && tier.unitPrices[field] >= 0
      )
    ) {
      const lowest = Math.min(...tiers.map((tier) => tier.unitPrices[field]))
      const price = formatPrice(lowest * groupRatio * fx, quote.currency, toIntlLocale(i18n.language))
      const label = field === 'videos' ? 'Fixed (per video)' : field === 'seconds' ? 'Per second' : 'Per million tokens'
      return (
        <span className="price-display">
          {tiers.length > 1 && <small className="small-note">{t('Lowest price')} · </small>}
          {price} · {t(label)}
        </span>
      )
    }
  }
  if (quote?.billing_group_scoped && quote.group.startsWith('dddai-') && quote.billing_expr && groupRatio !== undefined) {
    const parts = pricingExpressionParts(quote.billing_expr)
    const document = parseVisualBillingDocument(parts.prefix + parts.billingExpr)
    const fx = quote.currency === 'USD' ? 1 : exchangeRate
    let tier = document?.root
    while (
      tier?.kind === 'branch' &&
      tier.condition.kind === 'comparison' &&
      tier.condition.probe === 'len' &&
      ['<', '<='].includes(tier.condition.operator)
    )
      tier = tier.yes
    if (tier?.kind === 'tier' && tier.billingUnit === 'token' && fx && fx > 0) {
      const input = tier.prices.find((price) => price.variable === 'p')
      const output = tier.prices.find((price) => price.variable === 'c')
      if (input && output) {
        const money = (value: string, ratio: number) => formatPrice(Number(value) * ratio * fx, quote.currency, toIntlLocale(i18n.language))
        return (
          <span className="price-display">
            <span>
              {t('Input')} {money(input.value, groupRatio)} / {t('Output')} {money(output.value, groupRatio)} · {t('Per million tokens')}
            </span>
            <small className="small-note">
              {t('Base prices before group ratio')}: {money(input.value, 1)} / {money(output.value, 1)}
            </small>
          </span>
        )
      }
    }
  }
  if (quote?.billing_group_scoped && quote.billing_expr && groupRatio !== undefined && Number.isFinite(groupRatio) && groupRatio >= 0) {
    const parts = pricingExpressionParts(quote.billing_expr)
    const document = !parts.requestRuleExpr && parseVisualBillingDocument(parts.prefix + parts.billingExpr)
    const fx = quote.currency === 'USD' ? 1 : exchangeRate
    if (document && fx !== undefined && Number.isFinite(fx) && fx > 0) {
      const tiers = comparablePriceTiers(document.root)
      const values = tiers.map((tier) => {
        if (tier.billingUnit === 'request') return [Number(tier.fixedPrice)]
        const input = tier.prices.find((price) => price.variable === 'p')
        const output = tier.prices.find((price) => price.variable === 'c')
        return input && output ? [Number(input.value), Number(output.value)] : []
      })
      const comparable = values.every(
        (value, index) =>
          value.length > 0 &&
          value.length === values[0].length &&
          tiers[index].billingUnit === tiers[0].billingUnit &&
          value.every((amount) => Number.isFinite(amount) && amount >= 0)
      )
      const lowest = comparable
        ? values.findIndex((candidate) => values.every((other) => candidate.every((amount, index) => amount <= other[index])))
        : -1
      if (lowest >= 0) {
        const money = (value: number) => formatPrice(value * groupRatio * fx, quote.currency, toIntlLocale(i18n.language))
        const amount = values[lowest]
        const unit = document.imageCount ? t('Per image') : t('Per request')
        return (
          <span className="price-display">
            {tiers.length > 1 && <small className="small-note">{t('Lowest price')} · </small>}
            {tiers[lowest].billingUnit === 'request' ? (
              <span>
                {money(amount[0])} · {unit}
              </span>
            ) : (
              <span>
                {t('Input')} {money(amount[0])} / {t('Output')} {money(amount[1])} · {t('Per million tokens')}
              </span>
            )}
          </span>
        )
      }
    }
  }
  if (quote?.billing_group_scoped)
    return <span className="muted">{t(quote.status === 'unconfigured' || !quote.billing_expr?.trim() ? 'Unconfigured' : 'Dynamic pricing')}</span>
  if (!quote || !quote.components.length) return <span className="muted">{t('Dynamic pricing')}</span>
  const components = quote.components.filter((c) => ['input', 'output', 'request'].includes(c.kind))
  if (!components.length) return <span className="muted">{t('See price details')}</span>
  return (
    <span className="price-display">
      {components.map((part, index) => (
        <span key={part.kind}>
          {index > 0 && <span className="price-separator"> / </span>}
          {formatPrice(Number(part.amount), quote.currency, toIntlLocale(i18n.language))}
        </span>
      ))}
    </span>
  )
}

const vendorIcons: Record<string, string> = {
  anthropic: 'anthropic.svg',
  字节跳动: 'bytedance.svg',
  bytedance: 'bytedance.svg',
  kuaishou: 'kuaishou.png',
  快手: 'kuaishou.png',
  阿里巴巴: 'alibaba.svg',
  alibaba: 'alibaba.svg',
  minimax: 'minimax.svg',
  xai: 'xai.svg',
  deepseek: 'deepseek.svg',
  智谱: 'zhipu.svg',
  zhipu: 'zhipu.svg',
  'z.ai': 'zhipu.svg',
  zai: 'zhipu.svg',
  月之暗面: 'moonshot.svg',
  moonshot: 'moonshot.svg',
  'moonshot ai': 'moonshot.svg',
  moonshotai: 'moonshot.svg',
  openai: 'openai.svg',
  google: 'google.svg',
}

export function ProviderIcon({ provider, modelName, icon, size = 30 }: { provider: string; modelName?: string; icon?: string; size?: number }) {
  const [failed, setFailed] = useState('')
  const { t } = useTranslation()
  const configured = icon?.trim()
  const hasControlCharacters = configured && [...configured].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  let source: string | undefined
  if (configured && !hasControlCharacters && !/[\\\s]/.test(configured)) {
    if (configured.startsWith('/') && !configured.startsWith('//')) source = configured
    else if (/^https:\/\//i.test(configured)) {
      try {
        const url = new URL(configured)
        if (!url.username && !url.password) source = url.href
      } catch {
        // Invalid image metadata falls back to the provider or model brand.
      }
    }
  }
  if (!source) {
    const named = configured?.toLowerCase()
    const namedProduct = named && /^(bytedance|seedance|doubao|wan)(?:\.[a-z]+|-color)?$/.test(named)
    const vendor = vendorIcons[provider.trim().toLowerCase()]
    const name = namedProduct ? named : `${provider} ${modelName || ''}`.toLowerCase()
    if (!namedProduct && vendor) source = `/orbis/vendor-icons/${vendor}`
    else if (name.includes('bytedance') || name.includes('seedance') || name.includes('doubao')) source = '/orbis/home/bytedance-color.svg'
    else if (/(?:^|[^a-z])wan(?:\d|[^a-z]|$)/.test(name)) source = '/orbis/brand-icons/wan.png'
    else {
      const brand = name.includes('openai')
        ? 'openai'
        : name.includes('anthropic') || name.includes('claude')
          ? 'claude-color'
          : name.includes('google') || name.includes('gemini')
            ? 'gemini-color'
            : name.includes('deepseek')
              ? 'deepseek-color'
              : name.includes('qwen')
                ? 'qwen-color'
                : null
      if (brand) source = `/orbis/home/${brand}.svg`
    }
  }
  return source && source !== failed ? (
    <img
      className="provider-icon"
      src={source}
      width={size}
      height={size}
      alt={modelName || provider}
      title={source === '/orbis/vendor-icons/kuaishou.png' ? `${t('Source')}: Kuaishou (kuaishou.com)` : undefined}
      referrerPolicy="no-referrer"
      onError={() => setFailed(source)}
    />
  ) : (
    <span className="provider-fallback" style={{ width: size, height: size }}>
      {provider.slice(0, 1) || 'M'}
    </span>
  )
}
export function ModelCard({ model }: { model: CatalogModel }) {
  const { t, i18n } = useTranslation()
  const summary = catalogQuoteSummary(model, []),
    route = model.offerings.find((item) => item.offering_key === summary?.offering_key)
  return (
    <Link href={modelHref(model)} className="model-card flex flex-col">
      <div className="model-card-title">
        <ProviderIcon provider={model.provider} modelName={model.configured_model_id} icon={model.icon} />
        <ArrowUpRight size={16} />
      </div>
      <h3 className="line-clamp-1">{model.name}</h3>
      <code className="truncate">{model.configured_model_id}</code>
      <div className="model-card-price line-clamp-2 min-h-[2.5rem] flex-1">
        <PriceDisplay quote={summary?.quote} />
        <small>
          {t(quoteUnitLabel(summary?.quote))}
          {route && (
            <>
              {' '}
              · {t('Group')}: {catalogGroupLabel(route.name, t, route.public_description)}
            </>
          )}
        </small>
      </div>
      <div className="model-card-bottom mt-auto tabular-nums font-mono">
        <span>
          {t('Routes')} <b>{model.offerings_count}</b>
        </span>
        <span title={t('Context length')}>
          {model.context_window == null ? '—' : formatCompactNumber(model.context_window, toIntlLocale(i18n.resolvedLanguage || i18n.language))}
        </span>
      </div>
    </Link>
  )
}
