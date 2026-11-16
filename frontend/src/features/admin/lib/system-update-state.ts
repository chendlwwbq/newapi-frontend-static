'use client'

import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { selectLatestRelease } from './system-releases'

const preferenceEvent = 'eva:system-update-preferences'
const memory = new Map<number, string[]>()
const fallback = new Set<number>()
const preferenceKey = (userId: number) => `eva:ignored-system-update:${userId}`

export function ignoredVersions(userId: number): string[] {
  if (fallback.has(userId)) return memory.get(userId) || []
  try {
    const stored = localStorage.getItem(preferenceKey(userId))
    if (stored === null) return memory.get(userId) || []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return memory.get(userId) || []
  }
}
export function setVersionIgnored(userId: number, version: string, ignored: boolean) {
  const current = ignoredVersions(userId).filter((value) => value !== version)
  if (ignored) current.push(version)
  memory.set(userId, current)
  try {
    localStorage.setItem(preferenceKey(userId), JSON.stringify(current))
    fallback.delete(userId)
  } catch {
    fallback.add(userId)
  }
  window.dispatchEvent(new Event(preferenceEvent))
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(preferenceEvent, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(preferenceEvent, callback)
  }
}
export function useVersionIgnored(userId: number, version?: string) {
  return useSyncExternalStore(
    subscribe,
    () => !!version && ignoredVersions(userId).includes(version),
    () => false
  )
}
export function useSystemRelease() {
  return useQuery({
    queryKey: ['system-update'],
    staleTime: 3600_000,
    refetchInterval: 3600_000,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('https://api.github.com/repos/QuantumNous/new-api/releases?per_page=100', {
        credentials: 'omit',
        headers: { Accept: 'application/vnd.github+json' },
        signal,
      })
      if (!response.ok) throw new Error('Failed to check for updates')
      return selectLatestRelease(await response.json())
    },
  })
}
