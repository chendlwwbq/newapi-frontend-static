import { isRecord } from './settings-collections'

export const affinityKeyTypes = ['context_int', 'context_string', 'request_header', 'gjson'] as const
export interface AffinityKeySource extends Record<string, unknown> {
  type: string
  key?: string
  path?: string
}
export interface AffinityRule extends Record<string, unknown> {
  name?: string
  model_regex?: string[] | null
  path_regex?: string[] | null
  user_agent_include?: string[] | null
  key_sources?: AffinityKeySource[] | null
  value_regex?: string
  ttl_seconds?: number
  session_mode?: string
  skip_retry_on_failure?: boolean
  include_using_group?: boolean
  include_model_name?: boolean
  include_rule_name?: boolean
  param_override_template?: Record<string, unknown> | null
}
export function parseAffinityRules(source: string): AffinityRule[] | null {
  try {
    const rows: unknown = JSON.parse(source || '[]')
    if (!Array.isArray(rows)) return null
    for (const row of rows) {
      if (!isRecord(row)) return null
      if (['name', 'value_regex'].some((key) => row[key] !== undefined && typeof row[key] !== 'string')) return null
      if (row.session_mode !== undefined && !['', 'inherit', 'off', 'prefer', 'strict'].includes(String(row.session_mode))) return null
      if (row.ttl_seconds !== undefined && typeof row.ttl_seconds !== 'number') return null
      if (
        ['skip_retry_on_failure', 'include_using_group', 'include_model_name', 'include_rule_name'].some(
          (key) => row[key] !== undefined && typeof row[key] !== 'boolean'
        )
      )
        return null
      if (
        ['model_regex', 'path_regex', 'user_agent_include'].some(
          (key) => row[key] != null && (!Array.isArray(row[key]) || !(row[key] as unknown[]).every((value) => typeof value === 'string'))
        )
      )
        return null
      if (
        row.key_sources != null &&
        (!Array.isArray(row.key_sources) ||
          !row.key_sources.every(
            (source) =>
              isRecord(source) &&
              affinityKeyTypes.includes(source.type as (typeof affinityKeyTypes)[number]) &&
              ['key', 'path'].every((key) => source[key] === undefined || typeof source[key] === 'string')
          ))
      )
        return null
      if (row.param_override_template != null && !isRecord(row.param_override_template)) return null
    }
    return rows as AffinityRule[]
  } catch {
    return null
  }
}
