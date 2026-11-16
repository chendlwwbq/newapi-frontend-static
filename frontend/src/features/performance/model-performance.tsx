'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { MetricTrend } from '@/components/shared/metric-trend'
import { useModelPerformance } from './use-performance'
import { performanceLabels, type PerformanceMetric } from './types'

export function ModelPerformance(props: { model: string }) {
  const { t, i18n } = useTranslation(),
    locale = toIntlLocale(i18n.language)
  const [hours, setHours] = useState(24),
    [group, setGroup] = useState(''),
    [metric, setMetric] = useState<PerformanceMetric>('success_rate')
  const query = useModelPerformance(props.model, hours)
  const current = query.data?.groups?.find((row) => row.group === group),
    points = current?.series || query.data?.series || []
  const summary = current || query.data?.summary
  const trend = points.map((point) => ({
    key: String(point.ts),
    timestamp: point.ts,
    value: (metric === 'avg_ttft_ms' && point.has_ttft === false) || (metric === 'avg_tps' && point.has_tps === false) ? null : point[metric],
  }))
  const format = (value: number) => {
    const result = formatNumber(value, locale)
    if (metric === 'success_rate') return `${result}%`
    if (metric === 'avg_tps') return `${result} tokens/s`
    return `${result} ms`
  }
  const units = { avg_tps: 'tokens/s', avg_latency_ms: 'ms', success_rate: t('Observed requests') }
  const date = (timestamp: number) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp * 1000)
  let content
  if (query.error) content = <ErrorState error={query.error} retry={() => query.refetch()} />
  else if (query.isPending) content = <LoadingState />
  else if (!query.data?.summary) content = <EmptyState title={t('No performance data in this time range')} />
  else
    content = (
      <>
        <div className="stat-grid">
          {(['avg_latency_ms', 'success_rate', 'avg_tps'] as const).map((key) => (
            <div
              className="stat-card rounded-2xl border-border/60 bg-card/70 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10"
              key={key}
            >
              <div>{t(performanceLabels[key])}</div>
              <strong className="tabular-nums font-mono">
                {key === 'avg_tps' && summary?.has_tps === false ? t('No measurements yet') : formatNumber(summary?.[key], locale)}
                {key === 'success_rate' && '%'}
              </strong>
              <small>{units[key]}</small>
            </div>
          ))}
        </div>
        <div className="performance-filters">
          <label>
            {t('Group')}
            <select value={current?.group || ''} onChange={(event) => setGroup(event.target.value)}>
              <option value="">{t('All groups')}</option>
              {query.data.groups?.map((row) => (
                <option key={row.group} value={row.group}>
                  {row.group}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Metric')}
            <select value={metric} onChange={(event) => setMetric(event.target.value as PerformanceMetric)}>
              {Object.entries(performanceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {trend.some((point) => point.value !== null) ? (
          <MetricTrend
            points={trend}
            format={format}
            date={date}
            title={t(performanceLabels[metric])}
            selectionLabel={t('Select a point to inspect performance')}
            controlsLabel={t('Performance samples')}
            missingLabel={t('No measurements yet')}
          />
        ) : (
          <EmptyState title={t('No performance data in this time range')} />
        )}
        <p className="small-note">{t('Performance is aggregated from observed requests. Empty periods are not a health guarantee.')}</p>
      </>
    )
  return (
    <section className="console-panel model-performance">
      <div className="performance-heading">
        <div>
          <h2>{t('Model performance')}</h2>
          <code>{props.model}</code>
        </div>
        <div className="performance-filters">
          <label>
            {t('Time range')}
            <select value={hours} onChange={(event) => setHours(Number(event.target.value))}>
              {[6, 24, 72, 168].map((value) => (
                <option key={value} value={value}>
                  {t('{{count}} hours', { count: value })}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            {t('Refresh')}
          </Button>
        </div>
      </div>
      {content}
    </section>
  )
}
