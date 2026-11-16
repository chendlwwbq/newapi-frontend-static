import type { Description } from './contracts'

export type LegacyPriceRow = { label: string; amount: number; unit: 'request' | 'token' }

/** Display native effective values; these estimates never calculate a request charge. */
export function legacyPriceRows(description: Description, quotaPerUnit?: number): LegacyPriceRow[] {
  const value = description.effective,
    details = description.billing_details
  if (value['billing_setting.billing_mode'] === 'tiered_expr') return []
  if (value.ModelPrice !== undefined) return [{ label: 'Per request', amount: value.ModelPrice, unit: 'request' }]
  const rows: LegacyPriceRow[] = []
  if (value.ModelRatio !== undefined && quotaPerUnit && quotaPerUnit > 0) {
    const input = (value.ModelRatio * 1_000_000) / quotaPerUnit
    rows.push({ label: 'Input', amount: input, unit: 'token' })
    if (value.CompletionRatio !== undefined) rows.push({ label: 'Output', amount: input * value.CompletionRatio, unit: 'token' })
    for (const [key, label] of [
      ['CacheRatio', 'Cache read'],
      ['ImageRatio', 'Image input'],
    ] as const) {
      if (value[key] !== undefined) rows.push({ label, amount: input * value[key], unit: 'token' })
    }
    if (description.cache_write_mode !== 'none' && value.CreateCacheRatio !== undefined) {
      const write = input * value.CreateCacheRatio
      let label = 'Cache write'
      if (description.cache_write_mode === 'claude_ttl') label = 'Cache write (5 minutes)'
      if (description.cache_write_mode === 'openai_ttl') label = 'Cache write (30 minutes)'
      rows.push({ label, amount: write, unit: 'token' })
      // Native types/price_data.go: ClaudeCacheCreation1hMultiplier and OpenAICacheCreation12hMultiplier.
      if (description.cache_write_mode === 'claude_ttl') rows.push({ label: 'Cache write (1 hour)', amount: write * (6 / 3.75), unit: 'token' })
      if (description.cache_write_mode === 'openai_ttl') rows.push({ label: 'Cache write (12 hours)', amount: write * 2, unit: 'token' })
    }
  }
  // Native Gemini audio prices can be positive while the text price is zero.
  if (details?.audio_input_price !== undefined) rows.push({ label: 'Audio input', amount: details.audio_input_price, unit: 'token' })
  if (details?.audio_output_price !== undefined) rows.push({ label: 'Audio output', amount: details.audio_output_price, unit: 'token' })
  return rows
}
