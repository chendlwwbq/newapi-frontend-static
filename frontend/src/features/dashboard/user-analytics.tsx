'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/states'
import { useTokenAwareQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { userUsageHistory, trendPosition, nearestTrendIndex, type UserUsageRow, type UsageGranularity } from './lib/analytics'

const colors = ['var(--chart-1)', 'var(--chart-2)', '#7778f7', '#d14d91', '#447fc4', '#a47a36', '#499248', '#ac5b53']

export function UserAnalytics({
  rows,
  granularity,
  username,
  mode = 'user',
  metric = 'quota',
  format,
}: {
  rows: UserUsageRow[]
  granularity: UsageGranularity
  username: string
  mode?: 'user' | 'model'
  metric?: 'quota' | 'requests' | 'tokens'
  format?: (value: number) => string
}) {
  const { t, i18n } = useTranslation()
  const money = useTokenAwareQuotaFormatter()
  const [limit, setLimit] = useState(10)
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [active, setActive] = useState(0)
  const history = useMemo(() => userUsageHistory(rows, granularity, limit, username, metric), [rows, granularity, limit, username, metric])
  const display = format || money
  const selectedIndex = Math.min(active, history.buckets.length - 1)
  const selected = history.buckets[selectedIndex]
  const visible = history.users.filter((user) => !hidden.has(user.username))
  const maxRank = Math.max(1, ...history.users.map((user) => user[metric]))
  const maxTrend = history.buckets.reduce(
    (maximum, bucket) => visible.reduce((max, user) => Math.max(max, bucket.values.get(user.username) || 0), maximum),
    1
  )
  const date = (timestamp: number) =>
    new Intl.DateTimeFormat(toIntlLocale(i18n.language), {
      month: 'short',
      day: 'numeric',
      ...(granularity === 'hour' ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(timestamp * 1000)
  if (!history.users.length) return <EmptyState title={t('No data yet')} />
  const timestamps = history.buckets.map((bucket) => bucket.timestamp)
  const x = (index: number) => trendPosition(timestamps, index)
  const y = (value: number) => 190 - (value / maxTrend) * 160
  return (
    <section>
      <div className="analytics-heading">
        <h2>{t(mode === 'user' ? 'User Analytics' : 'Model Call Analytics')}</h2>
        <label className="field">
          <span>{t(mode === 'user' ? 'Top Users' : 'Top models')}</span>
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            {[5, 10, 20, 50].map((value) => (
              <option key={value} value={value}>
                {t('Top {{count}}', { count: value })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3>{t(mode === 'user' ? 'User Consumption Ranking' : 'Top models')}</h3>
      <div className="rankings-chart-values">
        {history.users.map((user, index) => (
          <div key={user.username}>
            <span>{user.username}</span>
            <strong>{display(user[metric])}</strong>
            <div
              style={{
                height: 6,
                width: `${Math.max(0, (user[metric] / maxRank) * 100)}%`,
                background: colors[index % colors.length],
                borderRadius: 4,
              }}
            />
          </div>
        ))}
      </div>
      <h3>{t(mode === 'user' ? 'User Consumption Trend' : 'Usage trend')}</h3>
      {!selected ? (
        <EmptyState title={t('No data yet')} />
      ) : (
        <div className="rankings-chart">
          <div className="rankings-chart-legend" role="group" aria-label={t('Chart series')}>
            {history.users.map((user, index) => (
              <Button
                key={user.username}
                variant="ghost"
                size="sm"
                aria-pressed={!hidden.has(user.username)}
                onClick={() =>
                  setHidden((current) => {
                    const next = new Set(current)
                    if (next.has(user.username)) next.delete(user.username)
                    else next.add(user.username)
                    return next
                  })
                }
              >
                <i style={{ background: colors[index % colors.length] }} />
                {user.username}
              </Button>
            ))}
          </div>
          <svg
            viewBox="0 0 800 225"
            role="img"
            aria-label={t(mode === 'user' ? 'User Consumption Trend' : 'Usage trend')}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              const pointer = ((event.clientX - rect.left) / rect.width) * 800
              setActive(nearestTrendIndex(timestamps, pointer))
            }}
          >
            {[0, 0.5, 1].map((tick) => (
              <g key={tick}>
                <line x1="64" x2="776" y1={y(maxTrend * tick)} y2={y(maxTrend * tick)} stroke="var(--border)" strokeDasharray="4 5" />
                <text x="56" y={y(maxTrend * tick)} textAnchor="end">
                  {display(maxTrend * tick)}
                </text>
              </g>
            ))}
            {history.users.map((user, index) => {
              if (hidden.has(user.username)) return null
              const points = history.buckets.map((bucket, point) => `${x(point)},${y(bucket.values.get(user.username) || 0)}`).join(' '),
                color = colors[index % colors.length]
              return (
                <g key={user.username}>
                  <polygon points={`${x(0)},190 ${points} ${x(history.buckets.length - 1)},190`} fill={color} opacity="0.12" />
                  <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
                </g>
              )
            })}
            <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="25" y2="190" stroke="var(--muted-foreground)" strokeDasharray="3 4" />
            {[0, history.buckets.length - 1]
              .filter((value, index, all) => all.indexOf(value) === index)
              .map((index) => (
                <text key={index} x={x(index)} y="215" textAnchor={index === 0 ? 'start' : 'end'}>
                  {date(history.buckets[index].timestamp)}
                </text>
              ))}
          </svg>
          <label className="rankings-chart-selection">
            <span>
              {t('Inspect history')}: <strong>{date(selected.timestamp)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={history.buckets.length - 1}
              value={selectedIndex}
              aria-label={t('Inspect history')}
              aria-valuetext={date(selected.timestamp)}
              onChange={(event) => setActive(Number(event.target.value))}
            />
          </label>
          <div className="rankings-chart-values" aria-live="polite">
            {visible.map((user) => (
              <div key={user.username}>
                <span>{user.username}</span>
                <strong>{display(selected.values.get(user.username) || 0)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
