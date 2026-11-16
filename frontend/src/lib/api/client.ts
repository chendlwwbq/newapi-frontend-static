'use client'

import { freshAuthHeaders } from '@/lib/auth/session'
import type { ApiEnvelope } from './types'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public data?: unknown
  ) {
    super(message)
  }
}
type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal; headers?: Record<string, string>; anonymous?: boolean }
export async function apiResponse<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T> & { url?: string; message_key?: string }> {
  const response = await fetch(path, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
    headers: { 'Content-Type': 'application/json', ...(!options.anonymous ? await freshAuthHeaders() : {}), ...options.headers },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
  const fallback = response.statusText.trim() || 'Request failed'
  const result: ApiEnvelope<T> & { url?: string; message_key?: string; error?: { message?: string; code?: string } } = await response
    .json()
    .catch(() => {
      let message = fallback
      if (response.status === 429) message = 'Too many requests'
      else if (response.ok) message = 'Invalid server response'
      throw new ApiError(message, response.status)
    })
  if (!response.ok || result.success === false || result.message === 'error') {
    const message = [result.message_key, result.message === 'error' ? result.data : result.message, result.error?.message].find(
      (value): value is string => typeof value === 'string' && !!value.trim()
    )
    throw new ApiError(message || (!response.ok ? fallback : 'Request failed'), response.status, result.code || result.error?.code, result.data)
  }
  return result
}
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiResponse<T>(path, options)).data
}
