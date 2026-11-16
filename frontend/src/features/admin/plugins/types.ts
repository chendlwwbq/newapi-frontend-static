export type PluginMeta = {
  key: string
  name: string
  version: string
  apiVersion: number
  icon?: string
  author?: { name: string; url?: string }
  description?: Record<string, string>
  models: string[] | null
  routes?: { method: string; path: string; type: string; models?: string[] }[]
  baseUrl?: string
  protocols?: (string | { name: string; models?: string[]; supports?: string[] })[]
  usageSchema?: unknown
  usageProfiles?: unknown[]
}
export type PluginRecord = {
  id: number
  key: string
  version: string
  source: string
  source_hash: string
  enabled: boolean
  active: boolean
  created_at: number
  remark: string
}
export type TaskPlugin = {
  meta: PluginMeta
  source: 'factory' | 'override' | 'override_over_factory'
  enabled: boolean
  active: boolean
  source_hash: string
  has_icon: boolean
  remark: string
  runtime_status: string
  runtime_error?: string
  factory_meta?: PluginMeta
  channel_count: number
  in_flight_count: number
}
export type PluginDetail = { plugin?: PluginRecord; meta: PluginMeta; source: string; layer: 'factory' | 'override'; has_icon?: boolean }
export type PluginUsage = { channels: { id: number; name: string }[]; in_flight_count: number }
export type PluginRuntime = {
  current_generation: number
  generation_published_at: string
  database_revision: string
  database_error?: string
  last_rebuild: { status: string; attempted_at: string; generation: number; database_revision?: string; plugin_error_count: number; error?: string }
  plugin_errors: Record<string, string>
}
export type MarketplaceSource = { name: string; index_url: string }
export type MarketplaceVersion = {
  version: string
  path: string
  sha256?: string
  minApiVersion?: number
  allowedHosts?: string[]
  baseUrl?: string
  auth?: string
}
export type MarketplacePlugin = {
  key: string
  name: string
  icon?: string
  iconFile?: { path: string; sha256?: string }
  description?: string | Record<string, string>
  models?: string[]
  latest: string
  versions: MarketplaceVersion[]
}
export type PluginUpload = {
  source: string
  remark: string
  icon?: string
  sourceSha256?: string
  marketplace?: { key: string; version: string; index: string }
}
