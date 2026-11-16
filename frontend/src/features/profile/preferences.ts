export type NotificationSettings = {
  notify_type: 'email' | 'webhook' | 'bark' | 'gotify'
  quota_warning_threshold: number
  quota_warning_enabled?: boolean
  notification_email: string
  webhook_url: string
  webhook_secret: string
  bark_url: string
  gotify_url: string
  gotify_token: string
  gotify_priority: number
  accept_unset_model_ratio_model: boolean
  record_ip_log: boolean
  upstream_model_update_notify_enabled: boolean
  channel_notify_enabled?: boolean
}
export function readPreferences(value?: string): Partial<NotificationSettings> & { language?: string } {
  if (!value) return {}
  try {
    return JSON.parse(value) || {}
  } catch {
    return {}
  }
}
/** Native settings updates replace this whole subset; keep untouched switches and secrets. */
export function notificationSettings(value?: string): NotificationSettings {
  const source = readPreferences(value)
  let method: NotificationSettings['notify_type'] = 'email'
  if (source.notify_type && ['email', 'webhook', 'bark', 'gotify'].includes(source.notify_type)) method = source.notify_type
  return {
    notify_type: method,
    quota_warning_threshold: source.quota_warning_threshold ?? 0,
    quota_warning_enabled: source.quota_warning_enabled,
    notification_email: source.notification_email ?? '',
    webhook_url: source.webhook_url ?? '',
    webhook_secret: source.webhook_secret ?? '',
    bark_url: source.bark_url ?? '',
    gotify_url: source.gotify_url ?? '',
    gotify_token: source.gotify_token ?? '',
    gotify_priority: source.gotify_priority ?? 5,
    accept_unset_model_ratio_model: source.accept_unset_model_ratio_model ?? false,
    record_ip_log: source.record_ip_log ?? false,
    upstream_model_update_notify_enabled: source.upstream_model_update_notify_enabled ?? false,
    channel_notify_enabled: source.channel_notify_enabled,
  }
}
export function checkinMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
export function monthCells(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1),
    days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return Array.from({ length: first.getDay() + days }, (_, index) =>
    index < first.getDay() ? null : `${checkinMonth(date)}-${String(index - first.getDay() + 1).padStart(2, '0')}`
  )
}
