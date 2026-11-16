'use client'
import { useEffect, useId, useRef, useState } from 'react'

export function MetricTrend(props: {
  points: { key: string; timestamp: number; value: number | null }[]
  format: (value: number) => string
  date: (timestamp: number) => string
  title: string
  selectionLabel: string
  controlsLabel: string
  missingLabel?: string
}) {
  const id = useId().replaceAll(':', ''),
    [active, setActive] = useState<number | null>(null),
    [keyboardIndex, setKeyboardIndex] = useState(0)
  const root = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(800)
  const controls = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    if (!root.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.min(800, Math.max(320, entry.contentRect.width))))
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  const actualMax = Math.max(...props.points.map((point) => point.value ?? 0), 0),
    max = actualMax || 1
  const x = (index: number) => (props.points.length === 1 ? (width + 40) / 2 : 64 + (index / Math.max(props.points.length - 1, 1)) * (width - 88))
  const y = (value: number) => 170 - (value / max) * 140
  const segments: string[][] = []
  props.points.forEach((point, index) => {
    if (point.value === null) return
    if (index === 0 || props.points[index - 1].value === null) segments.push([])
    segments.at(-1)!.push(`${x(index)},${y(point.value)}`)
  })
  const selected = active === null ? undefined : props.points[active]
  return (
    <div className="usage-chart" ref={root}>
      <div className="chart-caption" aria-live="polite">
        {selected ? (
          <>
            <span>{props.date(selected.timestamp)}</span>
            <strong>{selected.value === null ? props.missingLabel : props.format(selected.value)}</strong>
          </>
        ) : (
          <span>{props.selectionLabel}</span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} 210`} role="img" aria-label={props.title}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity=".18" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1="64" x2={width - 24} y1={y(tick * max)} y2={y(tick * max)} stroke="var(--border)" strokeDasharray="4 5" />
            <text x="56" y={y(tick * max) - 5} textAnchor="end" fill="var(--muted-foreground)" fontSize="10">
              {actualMax || tick === 0 ? props.format(tick * max) : ''}
            </text>
          </g>
        ))}
        {props.points.length > 1 && segments.length === 1 && props.points.every((point) => point.value !== null) && (
          <polygon points={`64,170 ${segments[0].join(' ')} ${width - 24},170`} fill={`url(#${id})`} />
        )}
        {segments.map((segment, index) => (
          <polyline key={index} points={segment.join(' ')} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" />
        ))}
        {props.points.map((point, index) => {
          let anchor: 'start' | 'end' | 'middle' = 'middle'
          if (props.points.length > 1) {
            if (index === 0) anchor = 'start'
            else if (index === props.points.length - 1) anchor = 'end'
          }
          return (
            <g key={point.key}>
              {(index === 0 || index === props.points.length - 1 || (width > 500 && index === Math.floor(props.points.length / 2))) && (
                <text x={x(index)} y="200" textAnchor={anchor} fill="var(--muted-foreground)" fontSize="10">
                  {props.date(point.timestamp)}
                </text>
              )}
              {point.value !== null &&
                (active === index ||
                  ((index === 0 || props.points[index - 1].value === null) &&
                    (index === props.points.length - 1 || props.points[index + 1].value === null))) && (
                  <circle cx={x(index)} cy={y(point.value)} r="4" fill="var(--chart-1)" />
                )}
            </g>
          )
        })}
      </svg>
      <div
        className="chart-day-controls"
        style={{ left: `${(64 / width) * 100}%`, right: `${(24 / width) * 100}%` }}
        role="group"
        aria-label={props.controlsLabel}
      >
        {props.points.map((point, index) => (
          <button
            key={point.key}
            ref={(element) => {
              controls.current[index] = element
            }}
            type="button"
            tabIndex={index === Math.min(keyboardIndex, props.points.length - 1) ? 0 : -1}
            aria-label={`${props.date(point.timestamp)}: ${point.value === null ? props.missingLabel : props.format(point.value)}`}
            onFocus={() => {
              setKeyboardIndex(index)
              setActive(index)
            }}
            onBlur={() => setActive(null)}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              let next = index
              if (event.key === 'ArrowRight') next = Math.min(index + 1, props.points.length - 1)
              else if (event.key === 'ArrowLeft') next = Math.max(index - 1, 0)
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = props.points.length - 1
              else return
              event.preventDefault()
              controls.current[next]?.focus()
            }}
          />
        ))}
      </div>
    </div>
  )
}
