export const numericFields = {
  ModelPrice: 'Price per request (USD)',
  ModelRatio: 'Input ratio',
  CompletionRatio: 'Output ratio',
  CacheRatio: 'Cache read ratio',
  CreateCacheRatio: 'Cache write ratio',
  ImageRatio: 'Image ratio',
  AudioRatio: 'Audio input ratio',
  AudioCompletionRatio: 'Audio output ratio',
}
export type Values = Partial<Record<keyof typeof numericFields, number>> & {
  'billing_setting.billing_mode'?: 'ratio' | 'tiered_expr'
  'billing_setting.billing_expr'?: string
  'billing_setting.plugin_billing_expr'?: Record<string, string>
  'billing_setting.group_billing_expr'?: Record<string, string>
}
export type LegacyBillingDetails = {
  audio_input_price?: number
  audio_output_price?: number
  image_count?: boolean
  request_rules?: { condition: string; multiplier: number }[]
  audio_text_branches?: boolean
}
export type Description = { effective: Values; cache_write_mode?: string; billing_details?: LegacyBillingDetails }
export type Entry = Description & {
  model_name: string
  version: string
  configured: Values
  usage_schema?: import('@/features/pricing/types').BillingUsageSchema
  plugin_variants?: {
    plugin_key: string
    plugin_name: string
    configured: string
    effective: string
    compatible: boolean
    stale?: boolean
    usage_schema: import('@/features/pricing/types').BillingUsageSchema
  }[]
}
export type Snapshot = { entries: Entry[]; empty_version: string }
export type PricingChange = { model_name: string; expected_version: string; pricing: Values }
export type SyncValues = Partial<
  Record<
    | 'model_ratio'
    | 'completion_ratio'
    | 'cache_ratio'
    | 'create_cache_ratio'
    | 'image_ratio'
    | 'audio_ratio'
    | 'audio_completion_ratio'
    | 'model_price',
    number
  >
> & { billing_expr?: string; billing_mode?: string }
export type SyncResult = {
  prices: Record<string, { current: SyncValues; upstreams: Record<string, SyncValues> }>
  test_results: { name: string; status: string; error?: string }[]
}
export type SyncChannel = { id: number; name: string; base_url: string; type?: number; status: number }

/** Native sync imports a complete model price while preserving provider-specific overrides. */
export function syncPricingChange(snapshot: Snapshot, model: string, source: SyncValues): PricingChange {
  const baseline = snapshot.entries.find((entry) => entry.model_name === model)
  const pricing: Values = { 'billing_setting.billing_mode': 'ratio' }
  if (source.billing_expr?.trim()) {
    pricing['billing_setting.billing_mode'] = 'tiered_expr'
    pricing['billing_setting.billing_expr'] = source.billing_expr
  } else {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value !== 'number' || (source.model_price !== undefined && key !== 'model_price')) continue
      const field = key
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('') as keyof typeof numericFields
      if (Object.hasOwn(numericFields, field)) {
        if (!Number.isFinite(value) || value < 0) throw new Error('Enter a finite, non-negative price.')
        pricing[field] = value
      }
    }
    if (pricing.ModelPrice === undefined && pricing.ModelRatio === undefined) throw new Error('No base input price')
  }
  if (baseline?.configured['billing_setting.plugin_billing_expr'])
    pricing['billing_setting.plugin_billing_expr'] = baseline.configured['billing_setting.plugin_billing_expr']
  if (baseline?.configured['billing_setting.group_billing_expr'])
    pricing['billing_setting.group_billing_expr'] = baseline.configured['billing_setting.group_billing_expr']
  return { model_name: model, expected_version: baseline?.version || snapshot.empty_version, pricing }
}

export const groupFields = {
  GroupRatio: 'Group ratio',
  TopupGroupRatio: 'Top-up group ratio',
  UserUsableGroups: 'Selectable groups',
  GroupGroupRatio: 'User-group price overrides',
  'group_ratio_setting.group_special_usable_group': 'Group visibility rules',
  AutoGroups: 'Automatic group order',
}
export function validateGroupSetting(key: string, value: string): string {
  if (key === 'DefaultUseAutoGroup') return value
  if (key === 'MaxTokenAutoGroups') {
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid numeric setting')
    return value
  }
  const parsed: unknown = JSON.parse(value)
  const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)
  const ratio = (item: unknown) => typeof item === 'number' && Number.isFinite(item) && item >= 0
  let valid = false
  if (key === 'AutoGroups')
    valid = Array.isArray(parsed) && parsed.every((item) => typeof item === 'string' && item.trim()) && new Set(parsed).size === parsed.length
  else if (object(parsed)) {
    valid = Object.entries(parsed).every(
      ([name, item]) =>
        name.trim() &&
        (key === 'UserUsableGroups'
          ? typeof item === 'string'
          : key === 'GroupGroupRatio' || key === 'group_ratio_setting.group_special_usable_group'
            ? object(item) &&
              Object.entries(item).every(([target, inner]) => target.trim() && (key === 'GroupGroupRatio' ? ratio(inner) : typeof inner === 'string'))
            : ratio(item))
    )
  }
  if (!valid) throw new Error('Invalid group configuration')
  return JSON.stringify(parsed)
}
