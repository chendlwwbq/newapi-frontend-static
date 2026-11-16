'use client'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { formatPrice } from '@/features/catalog/price-format'
import { legacyPriceRows } from './legacy-prices'
import type { Description } from './contracts'

export function LegacyPricePanel(props: { description: Description }) {
  const { t, i18n } = useTranslation(),
    locale = toIntlLocale(i18n.language)
  const status = useQuery({ queryKey: ['status'], queryFn: () => api<{ quota_per_unit: number }>('/api/status'), staleTime: 300_000 })
  if (props.description.effective['billing_setting.billing_mode'] === 'tiered_expr') return null
  const rows = legacyPriceRows(props.description, status.data?.quota_per_unit),
    details = props.description.billing_details
  return (
    <section className="legacy-price-panel">
      <h3>{t('Legacy price details')}</h3>
      <p className="small-note">{t('USD base prices before group ratios. Effective values include inherited defaults.')}</p>
      {!!rows.length && (
        <dl className="price-grid">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>
                {t(row.label)} <small>{t(row.unit === 'request' ? 'Per request' : 'Per million tokens')}</small>
              </dt>
              <dd>{formatPrice(row.amount, 'USD', locale)}</dd>
            </div>
          ))}
        </dl>
      )}
      {!rows.length && <p className="small-note">{t('Unavailable')}</p>}
      {details?.image_count && <p>{t('The request price is multiplied by image count.')}</p>}
      {details?.audio_text_branches && (
        <p className="small-note">
          {t('Audio and text requests use separate billing branches. Cache and image categories apply to the text branch.')}
        </p>
      )}
      {!!details?.request_rules?.length && (
        <>
          <h4>{t('Request multipliers')}</h4>
          <ul>
            {details.request_rules.map((rule, index) => (
              <li key={index}>
                <code>{rule.condition}</code>
                <span> ×{formatNumber(rule.multiplier, locale)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
