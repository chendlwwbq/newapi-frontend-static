'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toIntlLocale } from '@/i18n/languages'
import type { QuotaData } from '@/lib/api/types'
import { aggregateUsage, type UsageGranularity } from './lib/analytics'
import { UsageChart } from './usage-chart'
import { UserAnalytics } from './user-analytics'

export function ModelAnalytics({
  rows,
  start,
  end,
  granularity,
  metric,
  format,
}: {
  rows: QuotaData[]
  start: number
  end: number
  granularity: UsageGranularity
  metric: 'quota' | 'requests' | 'tokens'
  format: (value: number) => string
}) {
  const { t, i18n } = useTranslation()
  const [selected, setSelected] = useState('')
  const all = useMemo(() => aggregateUsage(rows, start, end, granularity), [rows, start, end, granularity])
  const model = useMemo(
    () =>
      selected
        ? aggregateUsage(
            rows.filter((row) => row.model_name === selected),
            start,
            end,
            granularity
          )
        : all,
    [rows, start, end, granularity, selected, all]
  )
  const ranking = [...all.models].sort((a, b) => b[metric] - a[metric])
  const total = ranking.reduce((sum, item) => sum + item[metric], 0)
  const percent = new Intl.NumberFormat(toIntlLocale(i18n.language), { style: 'percent', maximumFractionDigits: 1 })
  const modelRows = useMemo(
    () =>
      rows
        .filter((row) => row.created_at >= start && row.created_at <= end)
        .map((row) => ({ username: row.model_name, created_at: row.created_at, quota: row.quota, count: row.count, token_used: row.token_used })),
    [rows, start, end]
  )
  return (
    <section>
      <div className="analytics-heading">
        <h2>{t('Model Call Analytics')}</h2>
        <label className="field">
          <span>{t('Model')}</span>
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">{t('All models')}</option>
            {selected && !ranking.some((item) => item.model === selected) && (
              <option value={selected} disabled>
                {selected}
              </option>
            )}
            {ranking.map((item) => (
              <option key={item.model} value={item.model}>
                {item.model}
              </option>
            ))}
          </select>
        </label>
      </div>
      <UsageChart days={model.days} metric={metric} format={format} granularity={granularity} />
      <h3>{t(metric === 'quota' ? 'Quota Distribution' : metric === 'requests' ? 'Call Count Distribution' : 'Tokens')}</h3>
      <div className="rankings-chart-values">
        {ranking.map((item) => {
          const share = total > 0 ? item[metric] / total : 0
          return (
            <div key={item.model}>
              <span>{item.model}</span>
              <strong>
                {format(item[metric])} · {percent.format(share)}
              </strong>
              <div style={{ height: 6, width: `${Math.max(0, share * 100)}%`, background: 'var(--chart-2)', borderRadius: 4 }} />
            </div>
          )
        })}
      </div>
      <UserAnalytics rows={modelRows} granularity={granularity} username="" mode="model" metric={metric} format={format} />
    </section>
  )
}
