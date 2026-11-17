'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/states'
import { formatCompactNumber, formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { rankingHistory } from './rankings-history'
import type { ModelHistorySeries, VendorShareSeries } from './rankings-types'

const colors = ['var(--accent)', 'var(--chart-2)', 'var(--chart-1)', '#0ea5e9', '#d946ef', '#10b981', '#f59e0b', '#ec4899']

/** Stacked native ranking buckets; the dashboard UsageChart only supports one series. */
export function RankingsHistoryChart(props: { source: ModelHistorySeries | VendorShareSeries; share?: boolean }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const history = useMemo(() => rankingHistory(props.source, !!props.share), [props.source, props.share])
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(800)
  useEffect(() => {
    if (!root.current) return
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.min(800, Math.max(320, entry.contentRect.width))))
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [history.buckets.length])
  const visible = history.series.filter((name) => !hidden.has(name))
  const selectedIndex = Math.min(active, history.buckets.length - 1)
  const selected = history.buckets[selectedIndex]
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 })
  const valueLabel = (value: number) => (props.share ? percent.format(value) : formatCompactNumber(value, locale))
  if (!selected) return <EmptyState title={t('No data yet')} />
  const maximum = props.share
    ? 1
    : Math.max(1, ...history.buckets.map((bucket) => visible.reduce((total, name) => total + (bucket.values[name]?.value || 0), 0)))
  const step = (chartWidth - 96) / history.buckets.length
  return (
    <div className="rankings-chart" ref={root}>
      <div className="rankings-chart-legend" role="group" aria-label={t('Chart series')}>
        {history.series.map((name, index) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            key={name}
            aria-pressed={!hidden.has(name)}
            onClick={() =>
              setHidden((previous) => {
                const next = new Set(previous)
                if (next.has(name)) next.delete(name)
                else next.add(name)
                return next
              })
            }
          >
            <i style={{ background: colors[index % colors.length] }} />
            {['Unknown', 'Others'].includes(name) ? t(name) : name}
          </Button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} 260`}
        role="img"
        aria-label={t(props.share ? 'Provider share history' : 'Top models token history')}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = ((event.clientX - bounds.left) / bounds.width) * chartWidth
          setActive(Math.max(0, Math.min(history.buckets.length - 1, Math.floor((x - 72) / step))))
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1="72" x2={chartWidth - 24} y1={220 - tick * 192} y2={220 - tick * 192} stroke="var(--border)" strokeDasharray="3 5" />
            <text x="62" y={224 - tick * 192} textAnchor="end">
              {valueLabel(tick * maximum)}
            </text>
          </g>
        ))}
        {history.buckets.map((bucket, index) => {
          let accumulated = 0
          const x = 72 + index * step
          return (
            <g key={bucket.timestamp}>
              {index === selectedIndex && <rect x={x} y="20" width={step} height="200" fill="var(--muted)" />}
              {history.series.map((name, colorIndex) => {
                if (hidden.has(name)) return null
                const value = bucket.values[name]?.value || 0
                const height = (value / maximum) * 192
                accumulated += height
                return (
                  <rect
                    key={name}
                    x={x + step * 0.12}
                    y={220 - accumulated}
                    width={step * 0.76}
                    height={height}
                    rx={2}
                    fill={colors[colorIndex % colors.length]}
                  >
                    <title>{`${bucket.label} · ${name}: ${valueLabel(value)}`}</title>
                  </rect>
                )
              })}
              {(index === 0 || index === history.buckets.length - 1 || index === Math.floor(history.buckets.length / 2)) && (
                <text x={x + step / 2} y="246" textAnchor="middle">
                  {bucket.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <label className="rankings-chart-selection">
        <span>
          {t('Inspect history')}: <strong>{selected.label}</strong>
        </span>
        <Input
          type="range"
          min={0}
          max={history.buckets.length - 1}
          step={1}
          value={selectedIndex}
          aria-label={t('Inspect history')}
          aria-valuetext={selected.label}
          onChange={(event) => setActive(Number(event.target.value))}
        />
      </label>
      <div className="rankings-chart-values" aria-live="polite">
        {visible.map((name) => (
          <div key={name}>
            <span>{['Unknown', 'Others'].includes(name) ? t(name) : name}</span>
            <strong className="tabular-nums font-mono">{valueLabel(selected.values[name]?.value || 0)}</strong>
            {props.share && (
              <small className="tabular-nums font-mono">
                {formatNumber(selected.values[name]?.tokens || 0, locale)} {t('Tokens')}
              </small>
            )}
          </div>
        ))}
        {!visible.length && <p className="small-note">{t('Select a series to view history.')}</p>}
      </div>
    </div>
  )
}
