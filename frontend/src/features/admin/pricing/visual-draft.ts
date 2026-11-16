import { buildRequestRuleExpr, tryParseRequestRuleExpr, type RequestRuleGroup } from '@/features/pricing/lib/billing-expr'
import { pricingExpressionParts, hasDeclaredUsageKeys } from '@/features/pricing/expression-parts'
export { pricingExpressionParts, combinePricingDraft } from '@/features/pricing/expression-parts'
import { compileBillingExpression } from '@/features/pricing/lib/billing-expression/parser'
import {
  parseVisualBillingDocument,
  serializeVisualBillingDocument,
  type VisualBillingDocument,
  type VisualPricingNode,
} from '@/features/pricing/lib/billing-expression/visual'
import { tryParseTaskVisualConfig } from '@/features/pricing/lib/task-expr'
import type { BillingUsageSchema } from '@/features/pricing/types'

// The upstream builder omits incomplete conditions. Reject them before serialization.
export function requestRulesDraft(groups: RequestRuleGroup[]): { ok: boolean } {
  for (const group of groups) {
    if (!group.multiplier.trim() || !Number.isFinite(Number(group.multiplier)) || Number(group.multiplier) < 0 || !group.conditions.length)
      return { ok: false }
    for (const condition of group.conditions) {
      if (condition.source === 'time') {
        try {
          new Intl.DateTimeFormat('en', { timeZone: condition.timezone }).format()
        } catch {
          return { ok: false }
        }
      }
      const source = buildRequestRuleExpr([{ ...group, conditions: [condition] }])
      if (!source || compileBillingExpression(source).status !== 'ready') return { ok: false }
    }
  }
  return { ok: true }
}
export function parseRequestRulesDraft(source: string): RequestRuleGroup[] | null {
  if (!source.trim()) return []
  const groups = tryParseRequestRuleExpr(source)
  if (!groups) return null
  const original = compileBillingExpression(source),
    rebuilt = compileBillingExpression(buildRequestRuleExpr(groups))
  if (original.status !== 'ready' || rebuilt.status !== 'ready') return null
  const semantic = (key: string, value: unknown) => (key === 'start' || key === 'end' ? undefined : value)
  return JSON.stringify(original.ast, semantic) === JSON.stringify(rebuilt.ast, semantic) ? groups : null
}
export function taskVisualDraft(source: string, schema?: BillingUsageSchema) {
  if (!schema) return null
  const { billingExpr } = pricingExpressionParts(source)
  return hasDeclaredUsageKeys(billingExpr, schema) ? tryParseTaskVisualConfig(billingExpr, schema) : null
}
export function setVisualImageCount(document: VisualBillingDocument, enabled: boolean): VisualBillingDocument | null {
  if (enabled && !document.imageCount && !isRequestPricingTree(document.root)) return null
  const serialized = serializeVisualBillingDocument(document)
  if (!serialized.ok) return null
  if (enabled === !!document.imageCount) return document
  if (!enabled) {
    const result = serializeVisualBillingDocument({ ...document, imageCount: false })
    return result.ok ? parseVisualBillingDocument(result.source) : null
  }
  const { prefix, billingExpr } = pricingExpressionParts(serialized.source)
  return parseVisualBillingDocument(`${prefix}(${billingExpr}) * image_count`)
}
export function isRequestPricingTree(node: VisualPricingNode): boolean {
  return node.kind === 'branch' ? isRequestPricingTree(node.yes) && isRequestPricingTree(node.no) : node.billingUnit === 'request'
}
