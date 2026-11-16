'use client'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import type { Quote } from '@/lib/api/types'
import type { PricingModel, BillingUsageSchema } from '@/features/pricing/types'
import { parseVisualBillingDocument, type VisualPricingNode, type VisualCondition } from '@/features/pricing/lib/billing-expression/visual'
import { compileBillingExpression } from '@/features/pricing/lib/billing-expression/parser'
import { parseTaskTiersFromExpr, BILLING_PRICING_VARS } from '@/features/pricing/lib/billing-expr'
import { pricingExpressionParts, hasDeclaredUsageKeys } from '@/features/pricing/expression-parts'
import { PriceSimulation } from '@/features/pricing/price-simulation'
import { toIntlLocale } from '@/i18n/languages'
import { formatPrice, componentLabels } from './price-format'
import { videoBillingGroupSlot } from './video-billing'

const videoGroupPlugins: Record<string, string> = {
  'video-special': 'eva_video_special',
  'video-stable': 'eva_video_stable',
}

function conditionText(condition: VisualCondition): string {
  if (condition.kind === 'comparison')
    return `${condition.probe}${condition.timezone ? `(${JSON.stringify(condition.timezone)})` : ''} ${condition.operator} ${condition.value}`
  if (condition.kind === 'not') return `!(${conditionText(condition.child)})`
  return condition.children.map((child) => `(${conditionText(child)})`).join(condition.kind === 'all' ? ' && ' : ' || ')
}
function TierPrices({ node, money }: { node: VisualPricingNode; money: (value: number) => string }) {
  const { t } = useTranslation()
  if (node.kind === 'branch')
    return (
      <div className="public-price-branch">
        <p>
          {t('When matched')}: <code>{conditionText(node.condition)}</code>
        </p>
        <TierPrices node={node.yes} money={money} />
        <p>{t('Otherwise')}</p>
        <TierPrices node={node.no} money={money} />
      </div>
    )
  return (
    <section className="public-price-tier">
      <h4>
        {node.label} <small>{t(node.billingUnit === 'request' ? 'Per request' : 'Per million tokens')}</small>
      </h4>
      <dl className="price-grid">
        {node.billingUnit === 'request' ? (
          <div>
            <dt>{t('Per request')}</dt>
            <dd>{money(Number(node.fixedPrice))}</dd>
          </div>
        ) : (
          node.prices.map((price) => (
            <div key={price.variable}>
              <dt>
                {t(BILLING_PRICING_VARS.find((field) => field.key === price.variable)?.shortLabel || price.variable)} <code>{price.variable}</code>
              </dt>
              <dd>{money(Number(price.value))}</dd>
            </div>
          ))
        )}
      </dl>
    </section>
  )
}
function ExpressionPrices({
  expression,
  schema,
  groupRatio,
  currency,
  exchangeRate,
  modelName,
  group,
  referenceOnly = false,
}: {
  expression: string
  schema?: BillingUsageSchema
  groupRatio?: number
  currency: 'USD' | 'CNY'
  exchangeRate?: number
  modelName?: string
  group?: string
  referenceOnly?: boolean
}) {
  const { t, i18n } = useTranslation()
  const parts = pricingExpressionParts(expression),
    document = parseVisualBillingDocument(parts.prefix + parts.billingExpr),
    task = hasDeclaredUsageKeys(parts.billingExpr, schema) ? parseTaskTiersFromExpr(parts.billingExpr, schema, true) : [],
    compiled = compileBillingExpression(expression)
  const displayCurrency = currency === 'CNY' && exchangeRate ? 'CNY' : 'USD'
  const videoTemplate =
    (Boolean(group && videoBillingGroupSlot(group)) || /^(?:seedance-2-[05]|wan3p?)-.*-(?:second|video)$/.test(modelName || '')) &&
    schema?.seconds?.unit === 'second' &&
    schema?.videos?.unit === 'count'
  const money = (value: number) =>
    formatPrice(value * (groupRatio ?? 1) * (displayCurrency === 'CNY' ? exchangeRate! : 1), displayCurrency, toIntlLocale(i18n.language))
  return (
    <div className="public-expression-prices">
      <p className="small-note">
        {groupRatio === undefined ? (
          t('Base prices before group ratio')
        ) : (
          <>
            {t('Group ratio')}: ×{groupRatio}
          </>
        )}
      </p>
      {document ? (
        <>
          <TierPrices node={document.root} money={money} />
          {document.imageCount && <p>{t('Multiply by image count')}</p>}
        </>
      ) : task.length ? (
        task.map((tier, i) => (
          <section className="public-price-tier" key={i}>
            <h4>{tier.label}</h4>
            <p className="small-note">
              {tier.conditionText ||
                (tier.conditions.length
                  ? tier.conditions
                      .map(
                        (condition) =>
                          `${condition.field} == ${schema?.[condition.field]?.type === 'boolean' ? condition.value : JSON.stringify(condition.value)}`
                      )
                      .join(' && ')
                  : t('Otherwise'))}
            </p>
            <dl className="price-grid">
              {!(videoTemplate && tier.constant === 0 && Object.keys(tier.unitPrices).length > 0) && (
                <div>
                  <dt>{t('Fixed price')}</dt>
                  <dd>{money(tier.constant)}</dd>
                </div>
              )}
              {Object.entries(tier.unitPrices).map(([key, amount]) => (
                <div key={key}>
                  <dt>
                    {videoTemplate && key === 'seconds' ? (
                      t('Per second')
                    ) : videoTemplate && key === 'videos' ? (
                      t('Fixed (per video)')
                    ) : (
                      <>
                        {key} · {schema?.[key]?.unit === 'token' ? t('Per million tokens') : schema?.[key]?.unit}
                      </>
                    )}
                  </dt>
                  <dd>{money(amount)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      ) : (
        <p>{t('Dynamic pricing')}</p>
      )}
      {compiled.status === 'ready' &&
        compiled.requestRules.map((rule, i) => (
          <p className="small-note" key={i}>
            <code>{rule.cond}</code> · ×{rule.multiplier}
          </p>
        ))}
      {!referenceOnly && (
        <>
          <details className="price-expression-source">
            <summary>{t('Billing expression')}</summary>
            <pre>{expression}</pre>
          </details>
          <PriceSimulation expression={expression} schema={schema} groupRatio={groupRatio} />
        </>
      )}
    </div>
  )
}
function LegacyPrices({ quote, provider = false }: { quote: Quote; provider?: boolean }) {
  const { t, i18n } = useTranslation(),
    locale = toIntlLocale(i18n.language)
  const parts = provider ? quote.legacy_components || [] : quote.components
  const details = quote.legacy_details
  if (!parts.length) return <p>{t('Unconfigured')}</p>
  return (
    <>
      <dl className="price-grid">
        {parts.map((part) => {
          let unit = 'Per million tokens'
          if (part.unit === 'request') unit = 'Per request'
          if (part.unit === 'second') unit = 'Per second'
          if (part.unit === 'request' && quote.pricing_source === 'plugin') unit = 'Fixed (per video)'
          return (
            <div key={part.kind}>
              <dt>
                {part.unit === 'second' || quote.pricing_source === 'plugin' ? (
                  t(unit)
                ) : (
                  <>
                    {t(componentLabels[part.kind] || part.kind)} <small>{t(unit)}</small>
                  </>
                )}
              </dt>
              <dd>{formatPrice(Number(part.amount), quote.currency, locale)}</dd>
            </div>
          )
        })}
      </dl>
      {details?.image_count && <p className="small-note">{t('The request price is multiplied by image count.')}</p>}
      {details?.audio_text_branches && (
        <p className="small-note">
          {t('Audio and text requests use separate billing branches. Cache and image categories apply to the text branch.')}
        </p>
      )}
      {parts.some((part) => part.kind === 'gemini_audio_input') && (
        <p className="small-note">{t('Native Gemini audio uses its dedicated input price; audio output uses the text output price.')}</p>
      )}
      {!!details?.request_rules?.length && (
        <div className="public-request-rules">
          <h4>{t('Request multipliers')}</h4>
          <ul>
            {details.request_rules.map((rule, index) => (
              <li key={index}>
                <code>{rule.condition}</code> · ×{formatNumber(rule.multiplier, locale)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
export function PriceBreakdown({
  quote,
  pricing,
  groupRatio,
  exchangeRate,
}: {
  quote?: Quote
  pricing?: PricingModel
  groupRatio?: number
  exchangeRate?: number
}) {
  const { t } = useTranslation()
  if (!quote) return <p>{t('Unavailable')}</p>
  if (quote.pricing_source === 'channel') {
    if (!quote.billing_expr) return <p>{t('Dynamic pricing')}</p>
    return (
      <div className="public-price-breakdown">
        <ExpressionPrices
          expression={quote.billing_expr}
          schema={quote.billing_usage_schema}
          groupRatio={groupRatio}
          currency={quote.currency}
          exchangeRate={exchangeRate}
          group={quote.group}
        />
      </div>
    )
  }
  if (quote.pricing_source === 'plugin') {
    if (quote.status === 'dynamic' && quote.billing_expr) {
      const variant = pricing?.billing_plugin_variants?.find((item) => item.plugin_key === 'video-route-a')
      return (
        <div className="public-price-breakdown">
          <ExpressionPrices
            expression={quote.billing_expr}
            schema={variant?.billing_usage_schema}
            groupRatio={groupRatio}
            currency={quote.currency}
            exchangeRate={exchangeRate}
            modelName={pricing?.model_name}
          />
        </div>
      )
    }
    return (
      <div className="public-price-breakdown">
        <LegacyPrices quote={quote} />
      </div>
    )
  }
  if (quote.billing_group_scoped) {
    const expression = quote.billing_expr?.trim()
    if (quote.status === 'unconfigured' || !expression) return <p>{t('Unconfigured')}</p>
    if (quote.group.startsWith('dddai-') && groupRatio === undefined) return <p>{t('Unavailable')}</p>
    return (
      <div className="public-price-breakdown">
        <ExpressionPrices expression={expression} groupRatio={groupRatio} currency={quote.currency} exchangeRate={exchangeRate} />
        {quote.group.startsWith('dddai-') && (
          <ExpressionPrices expression={expression} currency={quote.currency} exchangeRate={exchangeRate} referenceOnly />
        )}
      </div>
    )
  }
  const variants = pricing?.billing_plugin_variants || []
  const selectedPlugin = videoGroupPlugins[quote.group]
  const scopedVideoGroup = !!selectedPlugin && variants.some((variant) => Object.values(videoGroupPlugins).includes(variant.plugin_key))
  const visibleVariants = scopedVideoGroup ? variants.filter((variant) => variant.plugin_key === selectedPlugin) : variants
  const expression = scopedVideoGroup ? undefined : pricing?.billing_expr || quote.billing_expr
  return (
    <div className="public-price-breakdown">
      {!scopedVideoGroup && !!quote.components.length && <LegacyPrices quote={quote} />}
      {expression && (
        <ExpressionPrices
          expression={expression}
          schema={pricing?.billing_usage_schema}
          groupRatio={groupRatio}
          currency={quote.currency}
          exchangeRate={exchangeRate}
          modelName={pricing?.model_name}
        />
      )}
      {visibleVariants.map((variant) => {
        let content = <p>{t('Unconfigured')}</p>
        if (variant.billing_expr)
          content = (
            <ExpressionPrices
              expression={variant.billing_expr}
              schema={variant.billing_usage_schema}
              groupRatio={groupRatio}
              currency={quote.currency}
              exchangeRate={exchangeRate}
              modelName={pricing?.model_name}
            />
          )
        else if (variant.billing_mode === 'ratio' && !scopedVideoGroup) content = <LegacyPrices quote={quote} provider />
        return (
          <section className="public-price-provider" key={variant.plugin_key}>
            <h4>
              {variant.plugin_name} <code>{variant.plugin_key}</code>
            </h4>
            {content}
          </section>
        )
      })}
      {scopedVideoGroup && !visibleVariants.length && <p>{t('Unconfigured')}</p>}
      {!scopedVideoGroup && !expression && !quote.components.length && !visibleVariants.length && <p>{t('Dynamic pricing')}</p>}
    </div>
  )
}
