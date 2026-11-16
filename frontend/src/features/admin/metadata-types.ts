export interface ModelMetadata {
  id: number
  model_name: string
  description?: string
  icon?: string
  tags?: string
  vendor_id?: number
  endpoints?: string
  status: number
  sync_official: number
  name_rule: number
  has_metadata?: boolean
  configured_channel_count?: number
  square_state?: string
  supported_endpoints?: string[]
  bound_channels?: { name: string; type: number }[]
  enable_groups?: string[]
}
export interface VendorMetadata {
  id: number
  name: string
  description?: string
  icon?: string
  status: number
  model_count?: number
  version?: string
}
