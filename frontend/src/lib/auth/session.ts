'use client'

import { useSyncExternalStore } from 'react'
import type { ApiEnvelope, AuthBundle } from '@/lib/api/types'

type SessionState = { phase: 'loading' | 'ready' | 'error'; bundle: AuthBundle | null; error?: string }
const initial: SessionState = { phase: 'loading', bundle: null }
let state = initial
const listeners = new Set<() => void>()
let refreshing: Promise<void> | null = null
let bootstrapping: Promise<void> | null = null
let generation = 0
let channel: BroadcastChannel | null = null
const SESSION_STORAGE_EVENT_KEY = 'new-api-next:session-event'
const subscribers = (callback: () => void) => {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function broadcastSessionCleared() {
  channel?.postMessage('logout')
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(SESSION_STORAGE_EVENT_KEY, String(Date.now()))
    } catch {
      // Ignore storage access errors in restricted browsing modes.
    }
  }
}

function publish(next: SessionState) {
  state = next
  listeners.forEach((fn) => fn())
}
export function useAuth() {
  return useSyncExternalStore(
    subscribers,
    () => state,
    () => initial
  )
}
export function acceptSession(bundle: AuthBundle) {
  generation++
  publish({ phase: 'ready', bundle })
}
export type SessionRotation = Omit<AuthBundle, 'user'> & { has_password?: boolean; notification_warning?: boolean }
export function acceptSessionRotation(rotation: SessionRotation) {
  const current = state.bundle
  if (!current) throw new Error('Session expired. Please sign in again.')
  acceptSession({
    ...current,
    ...rotation,
    user: { ...current.user, ...(rotation.has_password !== undefined ? { has_password: rotation.has_password } : {}) },
  })
}
export function authHeaders(): Record<string, string> {
  const bundle = state.bundle
  return bundle ? { Authorization: `Bearer ${bundle.access_token}`, 'X-Auth-Session': bundle.session.sid } : {}
}
export function clearSession() {
  generation++
  publish({ phase: 'ready', bundle: null })
}

export function invalidateExpiredSession() {
  const hadSession = !!state.bundle
  clearSession()
  if (hadSession) broadcastSessionCleared()
}

export async function refreshSession() {
  if (refreshing) return refreshing
  const epoch = generation
  const execute = async () => {
    if (epoch !== generation) return
    const response = await fetch('/api/user/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(state.bundle ? { 'X-Auth-Session': state.bundle.session.sid } : {}) },
    })
    const body: ApiEnvelope<AuthBundle> = await response.json().catch(() => {
      throw new Error(response.status === 429 ? 'Too many requests' : response.ok ? 'Session refresh failed' : response.statusText)
    })
    if (epoch !== generation) return
    if (!response.ok || !body.success) {
      if (response.status === 401) invalidateExpiredSession()
      throw new Error(body.message || 'Session refresh failed')
    }
    acceptSession(body.data)
  }
  refreshing = (async () => {
    if (navigator.locks) await navigator.locks.request('new-api-next:refresh', execute)
    else await execute()
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}
export async function freshAuthHeaders() {
  if (state.bundle && state.bundle.access_expires_at <= Date.now() / 1000 + 30) await refreshSession()
  return authHeaders()
}
export function bootstrapSession() {
  if (bootstrapping) return bootstrapping
  channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('new-api-next:session') : null
  channel?.addEventListener('message', (event) => {
    if (event.data === 'logout') clearSession()
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === SESSION_STORAGE_EVENT_KEY && event.newValue) clearSession()
    })
  }
  bootstrapping = (async () => {
    if (!document.cookie.split(';').some((part) => part.trim() === 'new_api_has_session=1')) {
      publish({ phase: 'ready', bundle: null })
      return
    }
    try {
      await refreshSession()
    } catch (error) {
      if (state.phase !== 'ready') publish({ phase: 'error', bundle: null, error: (error as Error).message })
    }
  })()
  return bootstrapping
}
export async function logout() {
  const response = await fetch('/api/user/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(await freshAuthHeaders()) },
    body: '{}',
  })
  const body = await response.json().catch(() => {
    throw new Error(response.status === 429 ? 'Too many requests' : response.ok ? 'Logout failed' : response.statusText)
  })
  if (!response.ok || !body.success) throw new Error(body.message || 'Logout failed')
  clearSession()
  broadcastSessionCleared()
}
