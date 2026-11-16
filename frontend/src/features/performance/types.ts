export interface PerformanceSummary {
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
  has_tps?: boolean
}
export interface PerformancePoint extends PerformanceSummary {
  ts: number
  avg_ttft_ms: number
  has_ttft?: boolean
}
export interface PerformanceGroup extends PerformanceSummary {
  group: string
  avg_ttft_ms: number
  has_ttft?: boolean
  has_tps?: boolean
  series: PerformancePoint[]
}
export interface PerformanceData {
  model_name: string
  summary: PerformanceSummary | null
  series: PerformancePoint[]
  groups: PerformanceGroup[]
  window_start: number
  window_end: number
  series_schema: string
}
export interface PerformanceOverview {
  summary: PerformanceSummary | null
  models: (PerformanceSummary & { model_name: string; recent_success_series?: { ts: number; success_rate: number }[] })[]
  window_start: number
  window_end: number
}
export type PerformanceMetric = 'avg_latency_ms' | 'avg_ttft_ms' | 'avg_tps' | 'success_rate'
export const performanceLabels: Record<PerformanceMetric, string> = {
  avg_latency_ms: 'Average latency',
  avg_ttft_ms: 'Time to first token',
  avg_tps: 'Output speed',
  success_rate: 'Success rate',
}
