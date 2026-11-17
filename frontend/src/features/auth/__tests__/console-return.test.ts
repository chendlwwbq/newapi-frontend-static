import { describe, expect, it } from 'vitest'
import { consoleReturnPath, safeInternalPath } from '../console-return'

describe('same-origin return paths', () => {
  it.each(['/\\evil.com', '/\tevil.com', '/\nevil.com', '/\u0000evil', '/\u007fevil', '//evil.com', 'https://evil.com', '/a/..//evil.com'])(
    'rejects unsafe destination %j',
    (value) => {
      expect(safeInternalPath(value)).toBeUndefined()
    }
  )
  it('preserves a valid internal query and fragment while normalizing dot segments', () => {
    expect(safeInternalPath('/docs/../keys?create=1&group=a%2Fb#connect')).toBe('/keys?create=1&group=a%2Fb#connect')
  })
  it('drops an unsafe nested return destination from the key-creation link', () => {
    const path = consoleReturnPath('/keys', '?create=1&returnTo=%2F%5Cevil.com')
    expect(new URL(path, 'https://eva.test').searchParams.has('returnTo')).toBe(false)
  })
})
