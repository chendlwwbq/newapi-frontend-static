import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AuthBundle } from '@/lib/api/types'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('navigator', {})
})
afterEach(() => {
  vi.unstubAllGlobals()
})
const bundle = (token: string, userId = 1): AuthBundle => ({
  access_token: token,
  access_expires_at: 2_000_000_000,
  session: { sid: `session-${userId}` },
  user: { id: userId, username: `user-${userId}`, group: 'default', role: 1, quota: 0, used_quota: 0, request_count: 0 },
})

it('a previous account refresh cannot overwrite a later login', async () => {
  const session = await import('./session')
  let resolve!: (response: unknown) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
  )
  session.acceptSession(bundle('old-account'))
  const pending = session.refreshSession()
  session.acceptSession(bundle('new-account', 2))
  resolve({ ok: true, json: async () => ({ success: true, data: bundle('old-account-refreshed') }) })
  await pending
  expect(session.authHeaders()).toEqual({ Authorization: 'Bearer new-account', 'X-Auth-Session': 'session-2' })
})

it('a refresh completing after logout cannot restore the session', async () => {
  const session = await import('./session')
  let resolve!: (response: unknown) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
  )
  session.acceptSession(bundle('old-token'))
  const pending = session.refreshSession()
  session.clearSession()
  resolve({ ok: true, json: async () => ({ success: true, data: bundle('late-token') }) })
  await pending
  expect(session.authHeaders()).toEqual({})
})
