'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { usePerformanceOverview } from '@/features/performance/use-performance'

export function PerformanceHealth() {
  const { t, i18n } = useTranslation()
  const query = usePerformanceOverview(24)
  const locale = toIntlLocale(i18n.language)
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  if (query.isPending) return <LoadingState />
  if (!query.data?.models.length || !query.data.summary) return <p className="small-note">{t('No performance data available')}</p>
  const { summary, models } = query.data
  return (
    <section>
      <div className="analytics-heading">
        <h3>
          {t('Performance health')} · {t('{{count}} hours', { count: 24 })}
        </h3>
        <Link className="text-link" href="/ops/model-performance">
          {t('Details')} ↗
        </Link>
      </div>
      <div className="stat-grid">
        {(
          [
            ['Success rate', summary.success_rate, '%'],
            ['Average latency', summary.avg_latency_ms, 'ms'],
            ['Output speed', summary.avg_tps, 'tokens/s'],
          ] as const
        ).map(([label, value, unit]) => (
          <div className="stat-card" key={label}>
            <div>{t(label)}</div>
            <strong>
              {label === 'Output speed' && summary.has_tps === false ? t('No measurements yet') : `${formatNumber(value, locale)} ${unit}`}
            </strong>
          </div>
        ))}
      </div>
      <div className="analytics-actions">
        {models.slice(0, 6).map((model) => (
          <span key={model.model_name}>
            <code>{model.model_name}</code> · {formatNumber(model.success_rate, locale)}%
          </span>
        ))}
      </div>
    </section>
  )
}
