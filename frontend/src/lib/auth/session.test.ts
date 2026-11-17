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

it('broadcasts session invalidation across tabs via BroadcastChannel and storage events', async () => {
  const postMessage = vi.fn()
  const channelListeners: ((event: MessageEvent) => void)[] = []
  const storageListeners: ((event: StorageEvent) => void)[] = []
  const setItem = vi.fn()

  class FakeBroadcastChannel {
    postMessage = postMessage
    addEventListener(_type: string, fn: (event: MessageEvent) => void) {
      channelListeners.push(fn)
    }
  }
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  vi.stubGlobal('document', { cookie: '' })
  vi.stubGlobal('window', {
    localStorage: { setItem },
    addEventListener: (_type: string, fn: (event: StorageEvent) => void) => storageListeners.push(fn),
  })

  const session = await import('./session')
  await session.bootstrapSession()
  session.acceptSession(bundle('active-token'))
  session.invalidateExpiredSession()
  expect(session.authHeaders()).toEqual({})
  expect(postMessage).toHaveBeenCalledWith('logout')
  expect(setItem).toHaveBeenCalledWith('new-api-next:session-event', expect.any(String))

  session.acceptSession(bundle('second-token'))
  storageListeners[0]({ key: 'new-api-next:session-event', newValue: '123' } as StorageEvent)
  expect(session.authHeaders()).toEqual({})
})
