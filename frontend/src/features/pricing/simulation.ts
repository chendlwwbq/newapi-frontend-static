import { evaluateBillingExpression } from './lib/billing-expression/runtime'
import { compileBillingExpression } from './lib/billing-expression/parser'
import type { BillingSimulationContext, TokenVariable } from './lib/billing-expression/types'
import type { BillingUsageSchema } from './types'

export type SimulationInput = {
  tokens: Partial<Record<TokenVariable, string>>
  usage: Record<string, string>
  body: string
  headers: string
  time: string
  imageCount: string
}
export function simulatePrice(expression: string, input: SimulationInput, schema?: BillingUsageSchema) {
  const compiled = compileBillingExpression(expression)
  if (compiled.status !== 'ready') return { error: compiled.diagnostic.detail }
  const context: BillingSimulationContext = { tokens: {}, usage: {} }
  for (const variable of compiled.variables) {
    if (variable === 'image_count') continue
    const value = input.tokens[variable]
    if (value === undefined || !value.trim() || !Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 2147483647)
      return { error: 'Enter non-negative integer token counts up to 2147483647.' }
    context.tokens![variable] = Number(value)
  }
  for (const [key, value] of Object.entries(input.usage)) {
    const field = schema?.[key]
    if (!value.trim()) continue
    if (field?.type === 'number') {
      const maximum = field.unit === 'count' ? 128 : field.unit === 'second' ? 3600 : 2147483647
      if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > maximum)
        return { error: 'Usage facts exceed their declared unit limits.' }
      context.usage![key] = Number(value)
    } else if (field?.type === 'boolean') {
      if (!['true', 'false'].includes(value)) return { error: 'Invalid usage facts' }
      context.usage![key] = value === 'true'
    } else if (field?.enum?.includes(value)) context.usage![key] = value
    else return { error: 'Invalid usage facts' }
  }
  let body: unknown, headers: unknown
  try {
    body = JSON.parse(input.body)
  } catch {
    return { error: 'Request body must be a JSON object.' }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Request body must be a JSON object.' }
  try {
    headers = JSON.parse(input.headers)
  } catch {
    return { error: 'Request headers must be a JSON object with string values.' }
  }
  if (!headers || typeof headers !== 'object' || Array.isArray(headers) || Object.values(headers).some((value) => typeof value !== 'string'))
    return { error: 'Request headers must be a JSON object with string values.' }
  const now = new Date(input.time)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.time) ||
    !Number.isFinite(now.getTime()) ||
    new Date(`${input.time.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== input.time.slice(0, 10)
  )
    return { error: 'Enter an ISO date and time with a timezone offset.' }
  context.now = now
  context.request = { body, headers: headers as Record<string, string> }
  if (compiled.variables.has('image_count')) {
    const count = Number(input.imageCount)
    if (!Number.isInteger(count) || count < 1 || count > 128) return { error: 'Billable image count must be an integer from 1 to 128.' }
    context.imageCount = count
  }
  const result = evaluateBillingExpression(compiled, context)
  if (result.status !== 'success') return { error: result.diagnostic.detail }
  return { result, usd: compiled.functions.has('u') ? result.cost : result.cost / 1000000 }
}
