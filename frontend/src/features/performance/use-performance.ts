'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/session'
import { api } from '@/lib/api/client'
import type { PerformanceData, PerformanceOverview } from './types'

export function useModelPerformance(model: string, hours = 24) {
  const { bundle, phase } = useAuth()
  return useQuery({
    queryKey: ['model-performance', bundle?.user.id || 0, bundle?.user.group || '', bundle?.session.sid || 'public', model, hours],
    enabled: phase === 'ready' && !!model,
    queryFn: ({ signal }) => api<PerformanceData>(`/api/perf-metrics?${new URLSearchParams({ model, hours: String(hours) })}`, { signal }),
    staleTime: 30_000,
  })
}
export function usePerformanceOverview(hours = 24, groups: string[] = []) {
  const { bundle, phase } = useAuth()
  const selectedGroups = [...new Set(groups)].sort()
  const params = new URLSearchParams({ hours: String(hours) })
  for (const group of selectedGroups) params.append('group', group)
  return useQuery({
    queryKey: ['performance-summary', bundle?.user.id || 0, bundle?.user.group || '', bundle?.session.sid || 'public', hours, selectedGroups],
    enabled: phase === 'ready',
    queryFn: ({ signal }) => api<PerformanceOverview>(`/api/perf-metrics/summary?${params}`, { signal }),
    staleTime: 30_000,
  })
}
