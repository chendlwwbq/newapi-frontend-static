'use client'
import { useTranslation } from 'react-i18next'
import { createCurrencyFormatter, DEFAULT_CURRENCY_CONFIG } from '@/lib/currency'
import { toIntlLocale } from '@/i18n/languages'
import type { DeploymentCost } from './types'
export function DeploymentQuote(props: { cost: DeploymentCost }) {
  const { t, i18n } = useTranslation()
  const format = createCurrencyFormatter({
    ...DEFAULT_CURRENCY_CONFIG,
    quotaDisplayType: 'CUSTOM',
    customCurrencySymbol: props.cost.currency.toUpperCase() + ' ',
    customCurrencyExchangeRate: 1,
  }).formatLocalCurrencyAmount
  const options = { locale: toIntlLocale(i18n.language), digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  return (
    <div className="deployment-cost">
      <h3>
        {t('Estimated cost')}: {format(props.cost.estimated_cost, options)}
      </h3>
      <dl>
        {(
          [
            ['compute_cost', 'Compute cost'],
            ['network_cost', 'Network cost'],
            ['storage_cost', 'Storage cost'],
            ['total_cost', 'Total'],
            ['hourly_rate', 'Hourly rate'],
          ] as const
        ).map(
          ([key, label]) =>
            props.cost.price_breakdown[key] !== undefined && (
              <div key={key}>
                <dt>{t(label)}</dt>
                <dd>{format(props.cost.price_breakdown[key], options)}</dd>
              </div>
            )
        )}
      </dl>
      <p className="small-note">{t('Confirming creates provider resources. The provider determines the final charge.')}</p>
    </div>
  )
}
