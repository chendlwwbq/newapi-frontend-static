import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { AuthBundle, Catalog, CatalogModel } from '@/lib/api/types'
import { homeCatalogKey, visibleHomeModels } from './home-catalog'

const catalog = (id: string): Catalog => ({ models: [{ model_key: id } as CatalogModel], total: 1, currency: 'CNY', schema_version: 1 })
const session = (id: number, group: string, sid: string): AuthBundle => ({
  access_token: 'fixture',
  access_expires_at: 2000000000,
  session: { sid },
  user: { id, username: 'fixture', role: 1, group, quota: 0, used_quota: 0, request_count: 0 },
})

describe('home catalog session isolation', () => {
  it('uses the public catalog only while anonymous, and waits for a signed-in user catalog', () => {
    const initial = catalog('public'),
      member = session(1, 'private', 'first')
    expect(visibleHomeModels({ phase: 'loading', bundle: null }, initial, undefined, false)[0].model_key).toBe('public')
    expect(visibleHomeModels({ phase: 'ready', bundle: member }, initial, undefined, false)).toEqual([])
    expect(visibleHomeModels({ phase: 'ready', bundle: member }, initial, catalog('private'), false)[0].model_key).toBe('private')
  })
  it('hides cached results after access or session failure', () => {
    const member = session(1, 'private', 'first'),
      cached = catalog('private')
    expect(visibleHomeModels({ phase: 'ready', bundle: member }, catalog('public'), cached, true)).toEqual([])
    expect(visibleHomeModels({ phase: 'error', bundle: null }, catalog('public'), undefined, false)).toEqual([])
  })
  it('does not reuse one session or group catalog for another session or anonymous user', () => {
    const client = new QueryClient(),
      first = session(1, 'private', 'first')
    client.setQueryData(homeCatalogKey(first), catalog('private'))
    expect(client.getQueryData(homeCatalogKey(null))).toBeUndefined()
    expect(client.getQueryData(homeCatalogKey(session(1, 'private', 'second')))).toBeUndefined()
    expect(client.getQueryData(homeCatalogKey(session(1, 'other', 'first')))).toBeUndefined()
    expect(client.getQueryData(homeCatalogKey(session(2, 'private', 'first')))).toBeUndefined()
  })
})
