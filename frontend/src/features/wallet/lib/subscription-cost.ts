// Match the gateway's decimal multiplication and ceiling without binary float drift.
export function subscriptionBalanceCost(price: number, quotaPerUnit: number): number | null {
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0) return null

  function decimal(value: number): { coefficient: bigint; scale: number } {
    const [mantissa, exponent = '0'] = value.toString().toLowerCase().split('e')
    const [whole, fraction = ''] = mantissa.split('.')
    return { coefficient: BigInt(whole + fraction), scale: fraction.length - Number(exponent) }
  }

  const a = decimal(price),
    b = decimal(quotaPerUnit)
  const scale = a.scale + b.scale
  let product = a.coefficient * b.coefficient
  if (scale > 0) {
    const divisor = 10n ** BigInt(scale)
    product = (product + divisor - 1n) / divisor
  } else if (scale < 0) product *= 10n ** BigInt(-scale)
  return product <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(product) : null
}
