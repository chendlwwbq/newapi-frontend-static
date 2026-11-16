import { NextRequest } from 'next/server'
import { describe, expect, test } from 'vitest'
import { proxy } from '../proxy'

describe('document security headers', () => {
  test('uses a fresh matching nonce and denies framing', () => {
    const first = proxy(new NextRequest('https://example.test/'))
    const second = proxy(new NextRequest('https://example.test/'))
    const policy = first.headers.get('content-security-policy') || ''
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1]

    expect(nonce).toBeTruthy()
    expect(second.headers.get('content-security-policy')).not.toBe(policy)
    expect(first.headers.get('x-middleware-request-x-nonce')).toBe(nonce)
    expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(policy)
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy.split('; ').find((part) => part.startsWith('script-src'))).not.toContain("'unsafe-inline'")
    expect(first.headers.get('x-frame-options')).toBe('DENY')
    expect(first.headers.get('cache-control')).toContain('no-store')
  })
})
