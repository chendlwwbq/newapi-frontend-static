import type { ModelHistorySeries, VendorShareSeries } from './rankings-types'

export interface RankingHistoryBucket {
  timestamp: string
  label: string
  values: Record<string, { value: number; tokens: number }>
}

/** Keep the API's bucket shares intact when series are hidden in the chart. */
export function rankingHistory(source: ModelHistorySeries | VendorShareSeries, share: boolean) {
  const buckets = new Map<string, RankingHistoryBucket>()
  const series = new Set<string>('models' in source ? source.models.map((item) => item.name) : source.vendors.map((item) => item.name))
  for (const point of source.points) {
    const name = 'model' in point ? point.model : point.vendor
    series.add(name)
    let bucket = buckets.get(point.ts)
    if (!bucket) {
      bucket = { timestamp: point.ts, label: point.label, values: Object.create(null) }
      buckets.set(point.ts, bucket)
    }
    const previous = bucket.values[name]
    const value = share && 'share' in point ? point.share : point.tokens
    bucket.values[name] = { value: (previous?.value || 0) + value, tokens: (previous?.tokens || 0) + point.tokens }
  }
  return { series: [...series], buckets: [...buckets.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) }
}
