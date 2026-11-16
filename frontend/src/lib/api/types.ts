import type { BillingUsageSchema } from '@/features/pricing/types'

export interface ApiEnvelope<T> {
  success: boolean
  message?: string
  data: T
  code?: string
}
export interface PageResult<T> {
  items: T[]
  page: number
  page_size: number
  total: number
}
export interface PriceComponent {
  kind: string
  amount: string
  quantity: number
  unit: string
}
export interface Quote {
  currency: 'CNY' | 'USD'
  status: string
  components: PriceComponent[]
  group: string
  pricing_source?: string
  billing_expr?: string
  billing_usage_schema?: BillingUsageSchema
  billing_group_scoped?: boolean
  legacy_components?: PriceComponent[]
  legacy_details?: { image_count?: boolean; audio_text_branches?: boolean; request_rules?: { condition: string; multiplier: number }[] }
}
export interface Offering {
  /** Frontend catalog grouping; original group and invocation ID remain unchanged. */
  catalog_model_key?: string
  catalog_label?: string
  catalog_description?: string
  offering_key: string
  name: string
  invocation_id: string
  public_description: string
  availability: string
  pricing_plugin_key?: string
  pricing_ambiguous?: boolean
  prices: Quote[]
  metrics: Metric[]
  access: { protocols: string[] }[]
}
export interface Metric {
  metric: string
  value?: number
  window?: string
  status: string
}
export interface CatalogModel {
  model_key: string
  configured_model_id: string
  name: string
  provider: string
  description: string
  modality: string
  icon: string
  context_window: number | null
  max_output_tokens: number | null
  offerings: Offering[]
  offerings_count: number
  price_summary: { offering_key: string; quote: Quote }[]
  metrics: Metric[]
  capabilities: string[]
  input_modalities: string[]
  output_modalities: string[]
}
export interface Catalog {
  models: CatalogModel[]
  model?: CatalogModel
  total: number
  currency: 'CNY' | 'USD'
  schema_version: number
  fx?: { cny_per_usd: string; source: string; status: string }
}
export interface User {
  id: number
  username: string
  display_name?: string
  email?: string
  has_password?: boolean
  role: number
  status?: number
  group: string
  quota: number
  used_quota: number
  request_count: number
  setting?: string
  sidebar_modules?: string
  permissions?: { sidebar_settings?: boolean; admin_permissions?: Record<string, Record<string, boolean>> }
}
export interface AuthBundle {
  access_token: string
  access_expires_at: number
  session: { sid: string }
  user: User
}
export interface Challenge {
  require_verification: true
  flow_token: string
  methods: { method: string; available: boolean }[]
  expires_at: number
}
export interface Token {
  id: number
  name: string
  key?: string
  status: number
  created_time: number
  expired_time: number
  remain_quota: number
  used_quota: number
  unlimited_quota: boolean
  group: string
  model_limits_enabled: boolean
  model_limits: string
  allow_ips: string
  cross_group_retry: boolean
  accessed_time?: number
  auto_groups?: string[] | null
  allow_user_quota_query?: boolean
}
export interface UsageLog {
  id: number
  created_at: number
  model_name: string
  token_name: string
  quota: number
  prompt_tokens: number
  completion_tokens: number
  use_time: number
  content: string
  type: number
  group: string
  other?: string
  username?: string
  user_id?: number
  channel?: number
  channel_name?: string
  token_id?: number
  is_stream?: boolean
  ip?: string
  request_id?: string
  upstream_request_id?: string
}
export interface QuotaData {
  id: number
  created_at: number
  model_name: string
  use_group: string
  token_used: number
  count: number
  quota: number
  cache_read_tokens: number
  cache_creation_tokens: number
}
export interface Task {
  id: number
  task_id: string
  platform: string
  group: string
  quota: number
  action: string
  status: string
  fail_reason: string
  progress: string
  created_at: number
  submit_time: number
  start_time: number
  finish_time: number
  result_discarded?: boolean
  legacy_video_available?: boolean
  properties?: { input?: string; origin_model_name?: string; upstream_model_name?: string }
}
