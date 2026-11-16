import { splitBillingExprAndRequestRules, combineBillingExpr } from './lib/billing-expr'
import { compileBillingExpression } from './lib/billing-expression/parser'
import { visitExpression } from './lib/billing-expression/types'
import type { BillingUsageSchema } from './types'

export function pricingExpressionParts(source: string) {
  const prefix = source.match(/^\s*v1:/)?.[0] || ''
  return { prefix, ...splitBillingExprAndRequestRules(prefix ? source.slice(prefix.length) : source) }
}
export function combinePricingDraft(body: string, previous: string) {
  const { prefix, requestRuleExpr } = pricingExpressionParts(previous)
  return prefix + combineBillingExpr(body, requestRuleExpr)
}
export function hasDeclaredUsageKeys(expression: string, schema?: BillingUsageSchema) {
  if (!schema) return false
  const compiled = compileBillingExpression(expression)
  if (compiled.status !== 'ready') return false
  let compatible = true
  visitExpression(compiled.ast, (node) => {
    if (node.kind === 'call' && node.name === 'u') {
      const key = node.args[0]
      if (key.kind !== 'literal' || typeof key.value !== 'string' || !schema[key.value]) compatible = false
    }
  })
  return compatible
}
