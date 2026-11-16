import 'server-only'
import { connection } from 'next/server'
import type { ApiEnvelope } from './types'
import { handleMock } from '@/mock/handler'

async function requestPublicData<T>(path: string, absentStatuses: number[] = []): Promise<T | null> {
  await connection()
  const response = await handleMock(new Request(`http://127.0.0.1:3031${path}`))
  if (absentStatuses.includes(response.status)) return null
  const result: ApiEnvelope<T> = await response.json()
  if (!response.ok || !result.success) throw new Error(result.message || 'New API is unavailable')
  return result.data
}

export async function publicApi<T>(path: string): Promise<T> {
  return (await requestPublicData<T>(path)) as T
}

/** Recheck native module access for each render; browser sessions never enter SSR caches. */
export async function publicModuleApi<T>(path: string): Promise<T | null> {
  return requestPublicData<T>(path, [401, 403])
}

export async function publicOptionalApi<T>(path: string): Promise<T | null> {
  return requestPublicData<T>(path, [404])
}
