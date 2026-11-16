import { expect, it } from 'vitest'
import { codexWindows, codexUsedPercent, codexResetAvailable, codexCreditTimestamp } from './codex-usage'

it('classifies reordered windows by duration and preserves zero usage', () => {
  const five = { limit_window_seconds: 18000, used_percent: 0 },
    week = { limit_window_seconds: 604800, used_percent: 60 }
  expect(codexWindows({ rate_limit: { primary_window: week, secondary_window: five } })).toEqual({ fiveHour: five, weekly: week })
  expect(codexUsedPercent(five)).toBe(0)
})
it('keeps missing or invalid usage unavailable and clamps real percentages', () => {
  for (const window of [undefined, null, {}, { used_percent: null }, { used_percent: NaN }]) expect(codexUsedPercent(window)).toBeUndefined()
  expect(codexUsedPercent({ used_percent: -1 })).toBe(0)
  expect(codexUsedPercent({ used_percent: 120 })).toBe(100)
})
it('uses the native free-account weekly fallback and unclassified paid window ordering', () => {
  const primary = { used_percent: 30 },
    secondary = { used_percent: 70 }
  expect(codexWindows({ plan_type: ' FREE ', rate_limit: { primary_window: primary } })).toEqual({ fiveHour: null, weekly: primary })
  expect(codexWindows({ rate_limit: { primary_window: primary, secondary_window: secondary } })).toEqual({ fiveHour: primary, weekly: secondary })
  expect(codexWindows(undefined)).toEqual({ fiveHour: null, weekly: null })
})
it('honors authoritative zero credits instead of falling back to a stale positive summary', () => {
  expect(codexResetAvailable({ available_count: 0 }, { rate_limit_reset_credits: { available_count: 3 } })).toBe(0)
  expect(codexResetAvailable(undefined, { rate_limit_reset_credits: { available_count: 2 } })).toBe(2)
  for (const value of [undefined, -1, NaN, 1.2]) expect(codexResetAvailable({ available_count: value }, undefined)).toBeUndefined()
})
it('converts ISO dates and epoch seconds without making missing dates look like 1970', () => {
  expect(codexCreditTimestamp('2026-10-27T10:00:00Z')).toBe(Date.UTC(2026, 9, 27, 10))
  expect(codexCreditTimestamp(1793095200)).toBe(1793095200000)
  for (const value of [undefined, null, '', 'invalid', 0]) expect(codexCreditTimestamp(value)).toBeUndefined()
})
