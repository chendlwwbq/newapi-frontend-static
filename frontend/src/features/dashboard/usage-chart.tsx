'use client'
import { useTranslation } from 'react-i18next'
import { toIntlLocale } from '@/i18n/languages'
import { MetricTrend } from '@/components/shared/metric-trend'
import type { UsageDay, UsageGranularity } from './lib/analytics'

export function UsageChart({
  days,
  metric,
  format,
  granularity,
}: {
  days: UsageDay[]
  metric: 'quota' | 'requests' | 'tokens'
  format: (value: number) => string
  granularity: UsageGranularity
}) {
  const { t, i18n } = useTranslation()
  const date = (timestamp: number) => {
    const formatter = new Intl.DateTimeFormat(toIntlLocale(i18n.language), {
      month: 'short',
      day: 'numeric',
      ...(granularity === 'hour' ? { hour: '2-digit', minute: '2-digit' } : {}),
    })
    if (granularity !== 'week') return formatter.format(timestamp * 1000)
    const end = new Date(timestamp * 1000)
    end.setDate(end.getDate() + 6)
    return `${formatter.format(timestamp * 1000)} – ${formatter.format(end)}`
  }
  return (
    <MetricTrend
      points={days.map((day) => ({ key: day.key, timestamp: day.timestamp, value: day[metric] }))}
      format={format}
      date={date}
      title={t('Usage trend')}
      selectionLabel={t('Usage trend')}
      controlsLabel={t('Usage trend')}
    />
  )
}
