import { describe, it, expect } from 'vitest'
import { newToken, quotaInput, tokenPayload, tokenStatus, tokenGroupSelectable } from './token-form'
import type { Token } from '@/lib/api/types'

describe('native token settings', () => {
  it.each([
    ['USD', 1, 500000],
    ['CNY', 7, 500000 / 7],
    ['TOKENS', 7, 1],
    ['CUSTOM', 7, 125000],
  ])('converts %s input using the configured unit', (type, rate, scale) => {
    const input = quotaInput({
      quota_per_unit: 500000,
      quota_display_type: type as string,
      usd_exchange_rate: rate as number,
      custom_currency_exchange_rate: 4,
      custom_currency_symbol: 'E',
    })
    expect(input.scale).toBeCloseTo(scale as number)
    expect(input.toQuota(input.toDisplay(1234567))).toBe(1234567)
    expect(input.toQuota(0)).toBe(0)
  })
  it('rejects invalid or unsafe quota input instead of producing an unsafe integer', () => {
    const input = quotaInput({ quota_per_unit: 500000 })
    for (const amount of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) expect(() => input.toQuota(amount)).toThrow()
  })
  it('keeps ordered auto groups and explicit privacy choices out of masked response fields', () => {
    const payload = tokenPayload({
      id: 4,
      name: 'worker',
      key: 'masked',
      group: 'auto',
      auto_groups: ['vip', 'default'],
      cross_group_retry: true,
      allow_user_quota_query: false,
      used_quota: 123,
      created_time: 10,
    })
    expect(payload.auto_groups).toEqual(['vip', 'default'])
    expect(payload.allow_user_quota_query).toBe(false)
    expect(payload).not.toHaveProperty('key')
    expect(payload).not.toHaveProperty('used_quota')
    expect(payload).not.toHaveProperty('created_time')
  })
  it('clears auto routing fields for a fixed group, while preserving an omitted legacy privacy setting', () => {
    const payload = tokenPayload({ group: 'vip', auto_groups: ['default'], cross_group_retry: true })
    expect(payload.auto_groups).toEqual([])
    expect(payload.cross_group_retry).toBe(false)
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('allow_user_quota_query')
  })
  it('uses the native default auto setting without overriding an explicit group', () => {
    expect(newToken({ quota_per_unit: 500000, default_use_auto_group: true }).group).toBe('auto')
    expect(newToken({ quota_per_unit: 500000, default_use_auto_group: true }, 'vip').group).toBe('vip')
  })
  it('requires an available group for new keys while preserving an existing key group', () => {
    const groups = { default: {}, vip: {}, auto: {} }
    expect(tokenGroupSelectable('vip', groups)).toBe(true)
    expect(tokenGroupSelectable('removed', groups)).toBe(false)
    expect(tokenGroupSelectable('removed', groups, 'removed')).toBe(true)
    expect(tokenGroupSelectable('', groups, '')).toBe(true)
    expect(tokenGroupSelectable('', groups)).toBe(false)
    expect(tokenGroupSelectable('other', groups, 'removed')).toBe(false)
    expect(tokenGroupSelectable('vip', undefined, 'vip')).toBe(false)
  })
  it('distinguishes disabled, expired, exhausted and active keys', () => {
    const token = { status: 1, expired_time: -1, unlimited_quota: false, remain_quota: 100 } as Token
    expect(tokenStatus(token, 100)).toBe('Enabled')
    expect(tokenStatus({ ...token, expired_time: 99 }, 100)).toBe('Expired')
    expect(tokenStatus({ ...token, remain_quota: 0 }, 100)).toBe('Exhausted')
    expect(tokenStatus({ ...token, status: 2, expired_time: 99, remain_quota: 0 }, 100)).toBe('Disabled')
    expect(tokenStatus({ ...token, unlimited_quota: true, remain_quota: 0 }, 100)).toBe('Enabled')
  })
})
