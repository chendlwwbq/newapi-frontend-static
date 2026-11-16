import { isRecord } from './settings-collections'

export const policyOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'not_contains', 'exists', 'not_exists'] as const
export interface AccessCondition extends Record<string, unknown> {
  field: string
  op: string
  value?: unknown
}
export interface AccessPolicy extends Record<string, unknown> {
  logic?: string
  conditions?: AccessCondition[]
  groups?: AccessPolicy[]
}

// Check only whether the editor can represent the data. Go remains the policy authority.
export function parseAccessPolicy(source: string): AccessPolicy | null {
  try {
    const policy: unknown = JSON.parse(source)
    return isAccessPolicy(policy) ? policy : null
  } catch {
    return null
  }
}
function isAccessPolicy(value: unknown): value is AccessPolicy {
  if (!isRecord(value)) return false
  if (value.logic !== undefined && (typeof value.logic !== 'string' || !['', 'and', 'or'].includes(value.logic.trim().toLowerCase()))) return false
  if (
    value.conditions !== undefined &&
    (!Array.isArray(value.conditions) ||
      !value.conditions.every(
        (condition) =>
          isRecord(condition) &&
          typeof condition.field === 'string' &&
          typeof condition.op === 'string' &&
          policyOperators.includes(condition.op.trim().toLowerCase() as (typeof policyOperators)[number])
      ))
  )
    return false
  return value.groups === undefined || (Array.isArray(value.groups) && value.groups.every(isAccessPolicy))
}
export const policyTemplates: Record<string, AccessPolicy> = {
  verifiedEmail: { logic: 'and', conditions: [{ field: 'email_verified', op: 'eq', value: true }] },
  levelAndActive: {
    logic: 'and',
    conditions: [
      { field: 'trust_level', op: 'gte', value: 2 },
      { field: 'active', op: 'eq', value: true },
    ],
  },
  orgOrRole: {
    logic: 'or',
    conditions: [
      { field: 'org', op: 'eq', value: 'core' },
      { field: 'roles', op: 'contains', value: 'admin' },
    ],
  },
}
