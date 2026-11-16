export type DocBinding = {
  id: number
  doc_id: number
  target_type: 'model' | 'rest_api' | 'rest_operation'
  target_key: string
  is_primary: boolean
  sort_order: number
}
export type DeveloperDoc = {
  id: number
  slug: string
  title: string
  summary: string
  source_type: 'markdown' | 'external'
  markdown_content: string
  external_url: string
  language: string
  status: number
  bindings: DocBinding[] | null
  created_time: number
  updated_time: number
}
export type DocSummary = Pick<DeveloperDoc, 'id' | 'slug' | 'title' | 'summary' | 'language'>
export type RestOperation = {
  id: number
  rest_api_id: number
  method: string
  path: string
  operation_id: string
  summary: string
  description: string
  enabled: boolean
  quota: number | null
  definition: Record<string, unknown>
  docs?: DocSummary[]
}
export type RestDefinition = {
  id: number
  slug: string
  name: string
  description: string
  group: string
  icon: string
  tags: string[]
  status: number
  operations: RestOperation[]
  schemas?: Record<string, unknown>
  docs?: DocSummary[]
  created_time: number
  updated_time: number
  relay_available?: boolean
}
export type RegistryList<T> = { items: T[]; total: number; page: number; page_size: number; version: number }
export type RestUpstream = { id: number; slug: string; name: string; description: string; icon: string; base_url: string; status: number }
export type RestCredentialSummary = { has_upstream_auth: boolean; auth_header_names: string[]; injection_keys: Record<string, string[]> }
export type RestUpstreamList = { items: (RestCredentialSummary & { upstream: RestUpstream })[]; version: number }
export type RestRelayConfig = RestCredentialSummary & { base_url: string; upstream_id: number; version: number }
