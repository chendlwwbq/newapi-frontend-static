import { describe, it, expect } from 'vitest'
import { simulatePrice, type SimulationInput } from '../simulation'

const input: SimulationInput = {
  tokens: { p: '800', c: '100', cr: '200', len: '1000' },
  usage: {},
  body: '{}',
  headers: '{}',
  time: '2026-10-26T10:00:00Z',
  imageCount: '1',
}
describe('explicit local price estimates', () => {
  it('uses normalized token quantities and converts USD per million once', () => {
    expect(simulatePrice('tier("base", p * 2 + c * 4 + cr * 0)', input).usd).toBe(0.002)
  })
  it('selects context tiers using full len independently of billable p', () => {
    const value = simulatePrice('len <= 900 ? tier("short", p * 2) : tier("long", p * 4)', input)
    expect(value.usd).toBe(0.0032)
    expect(value.result?.matchedTier).toBe('long')
  })
  it('charges a fixed request once and multiplies only the explicit image count', () => {
    expect(simulatePrice('tier("image", fixed(0.1)) * image_count', { ...input, imageCount: '3' }).usd).toBeCloseTo(0.3)
    expect(simulatePrice('tier("request", fixed(0))', input).usd).toBe(0)
  })
  it('does not divide task USD by one million a second time', () => {
    const schema = { seconds: { type: 'number' as const, unit: 'second' as const }, tokens: { type: 'number' as const, unit: 'token' as const } }
    expect(
      simulatePrice('tier("base", u("seconds") * 0.4 + u("tokens") * 10 / 1000000)', { ...input, usage: { seconds: '5', tokens: '1000000' } }, schema)
        .usd
    ).toBe(12)
  })
  it('reports matched and unmatched request rules without guessing missing headers', () => {
    const expression = '(tier("base", p * 2)) * (header("x-mode") == "fast" ? 2 : 1)'
    expect(simulatePrice(expression, input).result?.requestRules[0].matched).toBe(false)
    const value = simulatePrice(expression, { ...input, headers: '{"x-mode":"fast"}' })
    expect(value.usd).toBe(0.0032)
    expect(value.result?.requestRules[0].matched).toBe(true)
  })
  it('rejects malformed JSON, invalid headers, missing token counts and invalid image counts', () => {
    expect(simulatePrice('tier("base", p * 2)', { ...input, body: '[]' }).error).toBeTruthy()
    expect(simulatePrice('tier("base", p * 2)', { ...input, headers: '{"x":2}' }).error).toBeTruthy()
    expect(simulatePrice('tier("base", p * 2)', { ...input, tokens: {} }).error).toBeTruthy()
    expect(simulatePrice('tier("base", fixed(1)) * image_count', { ...input, imageCount: '1.5' }).error).toBeTruthy()
  })
  it('rejects invalid dates and task fact bounds, preserving unknown facts as missing', () => {
    const schema = { seconds: { type: 'number' as const, unit: 'second' as const } }
    expect(simulatePrice('tier("base", p * 2)', { ...input, time: '2026-02-30T10:00:00Z' }).error).toBeTruthy()
    expect(simulatePrice('tier("base", u("seconds") * 1)', { ...input, usage: { seconds: '3601' } }, schema).error).toBeTruthy()
    expect(simulatePrice('tier("base", u("seconds") * 1)', input, schema).error).toBeTruthy()
  })
})
