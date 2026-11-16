import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleMock, resetMockData } from '../handler'

async function request(path: string, init: RequestInit = {}) {
  return handleMock(new Request(`http://localhost:3031${path}`, init))
}

beforeEach(() => { resetMockData(); vi.restoreAllMocks() })

describe('local mock contracts', () => {
  it('accepts the existing refresh client JSON header with an empty request body', async () => {
    const response = await request('/api/user/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    expect(response.status).toBe(200)
    expect((await response.json()).data.user.username).toBe('mock-admin')
  })
  it('returns paginated channels and applies status and keyword together', async () => {
    const result = await (await request('/api/channel/search?p=1&page_size=2&status=1&keyword=OpenAI')).json()
    expect(result.success).toBe(true)
    expect(result.data.items).toHaveLength(2)
    expect(result.data.total).toBeGreaterThan(2)
    expect(result.data.items.every((row: { status: number; name: string }) => row.status === 1 && row.name.includes('OpenAI'))).toBe(true)
    const second = await (await request('/api/channel/search?p=2&page_size=2&status=1&keyword=OpenAI')).json()
    expect(second.data.items[0].id).not.toBe(result.data.items[0].id)
  })
  it('persists a model edit across requests and restores it on reset', async () => {
    await request('/api/models/', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, description: '重构预览', status: 0 }) })
    const hidden = await (await request('/api/models/search?square_state=hidden&keyword=gpt-4.1')).json()
    expect(hidden.data.items[0].description).toBe('重构预览')
    expect(hidden.data.items[0].status).toBe(0)
    const catalog = await (await request('/api/catalog/models')).json()
    expect(catalog.data.models.some((row: { configured_model_id: string }) => row.configured_model_id === 'gpt-4.1')).toBe(false)
    await request('/api/__mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"reset":true}' })
    expect((await (await request('/api/models/1')).json()).data.status).toBe(1)
  })
  it('creates and deletes an API key without touching a real service', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network access'))
    const created = await (await request('/api/token/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"本地测试","status":1}' })).json()
    expect((await (await request(`/api/token/${created.data.id}`)).json()).data.name).toBe('本地测试')
    await request(`/api/token/${created.data.id}`, { method: 'DELETE' })
    expect((await request(`/api/token/${created.data.id}`)).status).toBe(404)
    expect(network).not.toHaveBeenCalled()
  })
  it('returns empty lists for the empty scenario while keeping status and session usable', async () => {
    const headers = { cookie: 'mock_scenario=empty' }
    expect((await (await request('/api/channel', { headers })).json()).data.total).toBe(0)
    expect((await (await request('/api/catalog/models', { headers })).json()).data.models).toEqual([])
    expect((await request('/api/status', { headers })).status).toBe(200)
    expect((await request('/api/user/auth/refresh', { method: 'POST', headers })).status).toBe(200)
  })
  it('fails simulated writes in the error scenario without changing data', async () => {
    const response = await request('/api/models', { method: 'PUT', headers: { cookie: 'mock_scenario=error', 'Content-Type': 'application/json' }, body: '{"id":1,"status":0}' })
    expect(response.status).toBe(503)
    expect((await (await request('/api/models/1')).json()).data.status).toBe(1)
    expect((await request('/api/__mock', { headers: { cookie: 'mock_scenario=error' } })).status).toBe(200)
  })
  it('shows ordinary user permissions and rejects admin data in user mode', async () => {
    const headers = { cookie: 'mock_role=user' }
    expect((await (await request('/api/user/auth/refresh', { method: 'POST', headers })).json()).data.user.role).toBe(1)
    expect((await request('/api/channel', { headers })).status).toBe(403)
    expect((await request('/api/user/auth/refresh', { method: 'POST', headers: { cookie: 'mock_role=guest' } })).status).toBe(401)
  })
  it('records unknown endpoints and never reports an unsupported action as saved', async () => {
    const response = await request('/api/channel/real-upstream-operation', { method: 'POST' })
    expect(response.status).toBe(501)
    expect((await response.json()).success).toBe(false)
    expect((await (await request('/api/__mock')).json()).data.unhandled).toContain('POST /api/channel/real-upstream-operation')
  })
  it('rejects cross-origin mock control changes and malformed JSON', async () => {
    expect((await request('/api/__mock', { method: 'POST', headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: '{"role":"admin"}' })).status).toBe(403)
    expect((await request('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status).toBe(400)
  })
})
