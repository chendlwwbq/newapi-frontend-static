import { afterEach, expect, it, vi } from 'vitest'
import { ignoredVersions, setVersionIgnored } from './system-update-state'

afterEach(() => vi.unstubAllGlobals())

it('keeps ignored versions separate per user and restores individual notifications', () => {
  const items = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => items.set(key, value) })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  setVersionIgnored(1, 'v1.0.0', true)
  setVersionIgnored(1, 'v2.0.0', true)
  setVersionIgnored(2, 'v3.0.0', true)
  setVersionIgnored(1, 'v1.0.0', false)
  expect(ignoredVersions(1)).toEqual(['v2.0.0'])
  expect(ignoredVersions(2)).toEqual(['v3.0.0'])
})

it('keeps the current preference in memory when browser storage cannot be written', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {
      throw new Error('blocked')
    },
  })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  setVersionIgnored(9, 'v1.0.0', true)
  expect(ignoredVersions(9)).toEqual(['v1.0.0'])
  setVersionIgnored(9, 'v1.0.0', false)
  expect(ignoredVersions(9)).toEqual([])
})
