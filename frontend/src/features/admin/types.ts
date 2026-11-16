import type { User } from '@/lib/api/types'

// DTO fields follow the native New API management contracts.
export interface Channel {
  id: number
  name: string
  type: number
  key?: string
  status: number
  models: string
  group: string
  priority: number | null
  weight: number | null
  base_url: string | null
  tag: string | null
  remark: string | null
  response_time: number
  test_time: number
  used_quota: number
  balance: number
  openai_organization: string | null
  test_model: string | null
  auto_ban: number | null
  other: string
  model_mapping: string | null
  status_code_mapping: string | null
  setting: string | null
  settings: string
  param_override: string | null
  header_override: string | null
  channel_info?: { is_multi_key: boolean; multi_key_mode: string; multi_key_size: number }
}
export interface AdminUser extends User {
  status: number
  remark?: string
  created_at?: number
  last_login_at?: number
  DeletedAt?: string | null
  admin_permissions?: Record<string, Record<string, boolean>>
}
export interface Redemption {
  id: number
  name: string
  key: string
  status: number
  quota: number
  created_time: number
  redeemed_time: number
  expired_time: number
  used_user_id: number
}
