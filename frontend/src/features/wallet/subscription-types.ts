// Native New API subscription DTOs, without the admin form's Zod dependency.
export interface SubscriptionPlan {
  id: number
  title: string
  subtitle?: string
  price_amount: number
  currency: string
  duration_unit: 'year' | 'month' | 'day' | 'hour' | 'custom'
  duration_value: number
  custom_seconds?: number
  quota_reset_period: 'never' | 'daily' | 'weekly' | 'monthly' | 'custom'
  quota_reset_custom_seconds?: number
  enabled: boolean
  sort_order: number
  allow_balance_pay?: boolean
  allow_wallet_overflow?: boolean
  max_purchase_per_user: number
  total_amount: number
  upgrade_group?: string
  downgrade_group?: string
  stripe_price_id?: string
  creem_product_id?: string
  waffo_pancake_product_id?: string
}
export interface PlanRecord {
  plan: SubscriptionPlan
}
export interface UserSubscription {
  id: number
  user_id: number
  plan_id: number
  status: string
  source?: string
  start_time: number
  end_time: number
  amount_total: number
  amount_used: number
  next_reset_time?: number
}
export interface UserSubscriptionRecord {
  subscription: UserSubscription
}
export interface SelfSubscriptionData {
  billing_preference: string
  subscriptions: UserSubscriptionRecord[]
  all_subscriptions: UserSubscriptionRecord[]
}
