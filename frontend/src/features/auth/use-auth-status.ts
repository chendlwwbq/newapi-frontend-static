'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { SystemStatus } from './types'

export function useAuthStatus() {
  return useQuery({ queryKey: ['status'], queryFn: () => api<SystemStatus>('/api/status', { anonymous: true }), staleTime: 60_000 })
}
