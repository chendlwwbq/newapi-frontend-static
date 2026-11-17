'use client'

import Link from 'next/link'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useTokenAwareQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import {
  buildTrafficFlow,
  flowStages,
  updateFlowColumns,
  type FlowActive,
  type FlowKind,
  type FlowMetric,
  type FlowRole,
  type FlowRow,
  type FlowSelection,
} from './lib/traffic-flow'

const labels: Record<FlowKind, string> = { user: 'User', node: 'Node', token: 'API keys', group: 'Group', model: 'Model', channel: 'Channel' }

export function TrafficFlow({
  userId,
  role,
  start,
  end,
  username,
  initialOpen = false,
}: {
  userId: number
  role: FlowRole
  start: number
  end: number
  username: string
  initialOpen?: boolean
}) {
  const { t, i18n } = useTranslation()
  const money = useTokenAwareQuotaFormatter()
  const [open, setOpen] = useState(initialOpen)
  const [metric, setMetric] = useState<FlowMetric>('quota')
  const [selected, setSelected] = useState<FlowSelection[]>([])
  const [masked, setMasked] = useState(false)
  const [active, setActive] = useState<FlowActive>()
  const [keyboardIndex, setKeyboardIndex] = useState(0)
  const chartControls = useRef<(SVGElement | null)[]>([])
  const [visible, setVisible] = useState<FlowKind[]>(() => flowStages(role))
  const [limit, setLimit] = useState(50)
  const [overflow, setOverflow] = useState<'aggregate' | 'hide'>('aggregate')
  const all = role !== 'user'
  const params = new URLSearchParams({ start_timestamp: String(start), end_timestamp: String(end) })
  if (all && username) params.set('username', username)
  const query = useQuery({
    queryKey: ['traffic-flow', userId, role, start, end, username],
    queryFn: ({ signal }) => api<FlowRow[] | null>(`/api/data/flow${all ? '' : '/self'}?${params}`, { signal }),
    enabled: open && !!userId,
  })
  const graph = useMemo(
    () => buildTrafficFlow(query.data || [], role, metric, selected, { visible, limit, overflow }),
    [query.data, role, metric, selected, visible, limit, overflow]
  )
  const filterOptions = useMemo(
    () => buildTrafficFlow(query.data || [], role, metric, [], { visible, limit, overflow }),
    [query.data, role, metric, visible, limit, overflow]
  )
  const highlighted = useMemo(
    () => (active ? buildTrafficFlow(query.data || [], role, metric, selected, { visible, limit, overflow, active }) : undefined),
    [query.data, role, metric, selected, visible, limit, overflow, active]
  )
  const highlightedNodes = new Set(highlighted?.columns.flat().map((node) => node.id))
  const highlightedLinks = new Set(highlighted?.links.map((link) => JSON.stringify([link.source, link.target])))
  const visibleStages = flowStages(role).filter((kind) => visible.includes(kind))
  const nodeLabel = (node: { label: string; kind: FlowKind; other?: boolean }) =>
    node.other ? t(node.label) : masked && node.kind !== 'model' ? '••••' : node.label
  const nodesById = new Map(graph.columns.flat().map((node) => [node.id, node]))
  const number = (value: number) => new Intl.NumberFormat(toIntlLocale(i18n.language), { maximumFractionDigits: 0 }).format(value)
  const format = metric === 'quota' ? money : number
  const height = Math.max(360, ...graph.columns.map((column) => column.length * 28 + 60))
  const width = Math.max(800, graph.columns.length * 220)
  const positions = new Map<string, { x: number; y: number; height: number; value: number }>()
  graph.columns.forEach((column, index) => {
    const total = column.reduce((sum, node) => sum + node.value, 0)
    const available = height - 60 - Math.max(0, column.length - 1) * 8 - column.length * 6
    let y = 35
    for (const node of column) {
      const nodeHeight = 6 + (total > 0 ? (available * node.value) / total : available / column.length)
      positions.set(node.id, { x: 90 + (index * (width - 180)) / (graph.columns.length - 1), y, height: nodeHeight, value: node.value })
      y += nodeHeight + 8
    }
  })
  const sourceOffsets = new Map<string, number>(),
    targetOffsets = new Map<string, number>()
  const drawLinks = graph.links.filter(
    (link) => link.value > 0 && (positions.get(link.source)?.value || 0) > 0 && (positions.get(link.target)?.value || 0) > 0
  )
  const chartNodes = graph.columns.flat()
  const controlCount = drawLinks.length + chartNodes.length
  function navigateChart(event: KeyboardEvent<SVGElement>, index: number, choose: () => void) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose()
      return
    }
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(index + 1, controlCount - 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(index - 1, 0)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = controlCount - 1
    else return
    event.preventDefault()
    chartControls.current[next]?.focus()
  }
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t('Request flow')}</summary>
      {open && (
        <section>
          <div className="analytics-actions" role="group" aria-label={t('Flow width metric')}>
            {(
              [
                ['quota', 'By quota'],
                ['tokens', 'By tokens'],
                ['requests', 'By requests'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                variant={metric === value ? 'default' : 'outline'}
                aria-pressed={metric === value}
                onClick={() => {
                  setMetric(value)
                  setSelected([])
                  setActive(undefined)
                }}
              >
                {t(label)}
              </Button>
            ))}
            {(selected.length > 0 || active) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelected([])
                  setActive(undefined)
                }}
              >
                {t('Clear selection')}
              </Button>
            )}
            <Button variant="outline" aria-pressed={masked} onClick={() => setMasked((value) => !value)}>
              {t(masked ? 'Show sensitive data' : 'Hide sensitive data')}
            </Button>
          </div>
          <div className="analytics-actions">
            <label className="field">
              <span>{t('Display limit')}</span>
              <select
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value))
                  setSelected([])
                  setActive(undefined)
                }}
              >
                {[10, 20, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {t('Top {{count}}', { count: value })}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('Overflow items')}</span>
              <select
                value={overflow}
                onChange={(event) => {
                  setOverflow(event.target.value as 'aggregate' | 'hide')
                  setSelected([])
                  setActive(undefined)
                }}
              >
                <option value="aggregate">{t('Merge into Other')}</option>
                <option value="hide">{t('Hide')}</option>
              </select>
            </label>
          </div>
          <div className="analytics-actions" role="group" aria-label={t('Show or hide flow columns')}>
            {flowStages(role).map((kind) => (
              <Button
                key={kind}
                variant="outline"
                aria-pressed={visible.includes(kind)}
                disabled={visible.includes(kind) && visible.length <= 2}
                onClick={() => {
                  const next = updateFlowColumns(visible, selected, active, kind, active?.node ? nodesById.get(active.node)?.kind : undefined)
                  setVisible(next.visible)
                  setSelected(next.selected)
                  setActive(next.active)
                }}
              >
                {t(labels[kind])}
              </Button>
            ))}
          </div>
          {query.error ? (
            <ErrorState error={query.error} retry={() => query.refetch()} />
          ) : query.isPending ? (
            <LoadingState />
          ) : !filterOptions.columns[0]?.length ? (
            <EmptyState
              title={t('No flow data available')}
              description={t('No usage in this period. Aggregated data appears after collection is enabled and requests are recorded.')}
              action={
                <>
                  <Link className="pill-button" href="/playground">
                    {t('Playground')}
                  </Link>
                  <Link className="pill-button secondary" href="/keys?create=1">
                    {t('Create API key')}
                  </Link>
                </>
              }
            />
          ) : (
            <>
              <details>
                <summary>{t('Flow Filters')}</summary>
                {filterOptions.columns.map((column, index) => (
                  <div key={visibleStages[index]}>
                    <strong>{t(labels[visibleStages[index]])}</strong>
                    <div className="analytics-actions">
                      {column.map((node) => (
                        <Button
                          key={node.id}
                          variant="ghost"
                          aria-pressed={selected.some((item) => item.id === node.id)}
                          onClick={() => {
                            setActive(undefined)
                            setSelected((current) =>
                              current.some((item) => item.id === node.id)
                                ? current.filter((item) => item.id !== node.id)
                                : [...current, { id: node.id, kind: node.kind }]
                            )
                          }}
                        >
                          {nodeLabel(node)} · {format(node.value)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </details>
              {!graph.columns[0]?.length ? (
                <EmptyState
                  title={t('No flow data available')}
                  action={
                    selected.length > 0 ? (
                      <Button variant="outline" onClick={() => setSelected([])}>
                        {t('Clear selection')}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div style={{ overflow: 'auto', maxHeight: 620 }}>
                  <svg
                    role="group"
                    aria-label={t('Request flow')}
                    aria-keyshortcuts="ArrowRight ArrowLeft ArrowUp ArrowDown Home End"
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                  >
                    {visibleStages.map((kind, index) => (
                      <text
                        key={kind}
                        x={90 + (index * (width - 180)) / (graph.columns.length - 1)}
                        y={18}
                        textAnchor="middle"
                        fill="currentColor"
                        fontSize="12"
                      >
                        {t(labels[kind])}
                      </text>
                    ))}
                    {drawLinks.map((link, index) => {
                      const source = positions.get(link.source)!,
                        target = positions.get(link.target)!
                      const sy = source.y + (sourceOffsets.get(link.source) || 0),
                        ty = target.y + (targetOffsets.get(link.target) || 0)
                      const sh = (source.height * link.value) / source.value,
                        th = (target.height * link.value) / target.value
                      sourceOffsets.set(link.source, sy - source.y + sh)
                      targetOffsets.set(link.target, ty - target.y + th)
                      const sx = source.x + 7,
                        tx = target.x - 7,
                        mid = (sx + tx) / 2
                      const label = `${nodeLabel(nodesById.get(link.source)!)} → ${nodeLabel(nodesById.get(link.target)!)}: ${format(link.value)}`
                      const choose = () =>
                        setActive((current) =>
                          current?.link?.source === link.source && current.link.target === link.target
                            ? undefined
                            : { link: { source: link.source, target: link.target } }
                        )
                      return (
                        <path
                          key={`${link.source}:${link.target}`}
                          ref={(element) => {
                            chartControls.current[index] = element
                          }}
                          role="button"
                          tabIndex={index === Math.min(keyboardIndex, controlCount - 1) ? 0 : -1}
                          aria-label={label}
                          onFocus={() => setKeyboardIndex(index)}
                          onClick={choose}
                          onKeyDown={(event) => navigateChart(event, index, choose)}
                          d={`M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty} L ${tx} ${ty + th} C ${mid} ${ty + th}, ${mid} ${sy + sh}, ${sx} ${sy + sh} Z`}
                          fill="var(--chart-2)"
                          opacity={active ? (highlightedLinks.has(JSON.stringify([link.source, link.target])) ? 0.6 : 0.08) : 0.3}
                        >
                          <title>{label}</title>
                        </path>
                      )
                    })}
                    {chartNodes.map((node, nodeIndex) => {
                      const pos = positions.get(node.id)!,
                        label = nodeLabel(node),
                        index = drawLinks.length + nodeIndex,
                        choose = () => setActive((current) => (current?.node === node.id ? undefined : { node: node.id }))
                      return (
                        <g
                          key={node.id}
                          ref={(element) => {
                            chartControls.current[index] = element
                          }}
                          role="button"
                          tabIndex={index === Math.min(keyboardIndex, controlCount - 1) ? 0 : -1}
                          aria-label={`${label}: ${format(node.value)}`}
                          onFocus={() => setKeyboardIndex(index)}
                          onClick={choose}
                          onKeyDown={(event) => navigateChart(event, index, choose)}
                          opacity={active && !highlightedNodes.has(node.id) ? 0.25 : 1}
                        >
                          <rect x={pos.x - 7} y={pos.y} width={14} height={pos.height} rx={3} fill="var(--primary)">
                            <title>
                              {label}: {format(node.value)}
                            </title>
                          </rect>
                          <text x={pos.x + 10} y={pos.y + 12} fontSize="11" fill="currentColor">
                            {label.length > 18 ? `${label.slice(0, 18)}…` : label}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </details>
  )
}
