import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth/session', () => ({ freshAuthHeaders: async () => ({ Authorization: 'Bearer test-only' }) }))
import { api, apiResponse } from './client'
afterEach(() => vi.unstubAllGlobals())

it('shows nested gateway errors when HTTP status text is empty', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Invalid URL (GET /api/task/stat/self)' } }), { status: 404 }))
  )
  await expect(api('/api/task/stat/self')).rejects.toMatchObject({ status: 404, message: 'Invalid URL (GET /api/task/stat/self)' })
})

it('uses a nonempty fallback for an empty HTTP error response', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 502 }))
  )
  await expect(api('/api/task/stat/self')).rejects.toMatchObject({ status: 502, message: 'Request failed' })
})

it('keeps translated dashboard error keys ahead of nested gateway messages', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ success: false, message_key: 'Permission denied', error: { message: 'internal detail' } }), { status: 403 })
    )
  )
  await expect(api('/api/task/stat/self')).rejects.toThrow('Permission denied')
})

it('retains the Epay form URL and signed fields', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify({ message: 'success', url: 'https://pay.example.test/submit', data: { sign: 'server-signature' } }))
    )
  )
  const result = await apiResponse('/api/user/pay', { method: 'POST', body: { amount: 10, payment_method: 'alipay' } })
  expect(result.url).toBe('https://pay.example.test/submit')
  expect(result.data).toEqual({ sign: 'server-signature' })
})
it('rejects legacy payment errors even when the HTTP status is 200', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ message: 'error', data: 'Payment amount is too low' })))
  )
  await expect(api('/api/user/amount')).rejects.toThrow('Payment amount is too low')
})
it('reports native empty 429 responses as rate limits', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 429, statusText: 'Too Many Requests' }))
  )
  await expect(api('/api/verify')).rejects.toMatchObject({ status: 429, message: 'Too many requests' })
})
it('retains already-created codes when native batch generation reports a partial failure', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ success: false, message: 'Batch creation failed', data: ['already-created-code'] })))
  )
  await expect(api('/api/redemption')).rejects.toMatchObject({ message: 'Batch creation failed', data: ['already-created-code'] })
})
