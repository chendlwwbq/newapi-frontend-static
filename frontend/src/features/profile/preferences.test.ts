import { describe, it, expect } from 'vitest'
import { checkinMonth, monthCells, notificationSettings } from './preferences'
import { updateNavigationModule } from '@/components/layout/navigation-config'

describe('native profile preferences', () => {
  it('does not materialize server-defaulted switches merely by saving another field', () => {
    const settings = notificationSettings('{}')
    expect(settings.quota_warning_enabled).toBeUndefined()
    expect(settings.channel_notify_enabled).toBeUndefined()
    expect(JSON.parse(JSON.stringify(settings))).not.toHaveProperty('quota_warning_enabled')
  })
  it('preserves existing notification secrets and explicit false/zero values across a full-subset update', () => {
    const draft = notificationSettings(
      JSON.stringify({
        notify_type: 'gotify',
        gotify_url: 'https://notify.example.test',
        gotify_token: 'fixture',
        gotify_priority: 0,
        quota_warning_threshold: 0,
        quota_warning_enabled: false,
        channel_notify_enabled: false,
        record_ip_log: true,
        accept_unset_model_ratio_model: true,
      })
    )
    expect({ ...draft, notification_email: 'other@example.test' }).toMatchObject({
      notify_type: 'gotify',
      gotify_token: 'fixture',
      gotify_priority: 0,
      quota_warning_enabled: false,
      channel_notify_enabled: false,
      record_ip_log: true,
      accept_unset_model_ratio_model: true,
    })
  })
  it('falls back for missing or legacy malformed preferences', () => {
    expect(notificationSettings().notify_type).toBe('email')
    expect(notificationSettings('{').gotify_priority).toBe(5)
  })
  it('changes a personal navigation switch without erasing extension fields or another section', () => {
    const next = JSON.parse(
      updateNavigationModule(
        '{"console":{"enabled":true,"token":true,"extension":false},"plugin":{"enabled":true}}',
        'SidebarModulesAdmin',
        'console',
        false,
        'token'
      )
    )
    expect(next.console).toEqual({ enabled: true, token: false, extension: false })
    expect(next.plugin).toEqual({ enabled: true })
  })
  it('builds leap-year and year-boundary month cells using local dates', () => {
    const february = monthCells(new Date(2024, 1, 1))
    expect(february.filter(Boolean)).toHaveLength(29)
    expect(february.slice(0, 4)).toEqual([null, null, null, null])
    expect(february.at(-1)).toBe('2024-02-29')
    expect(checkinMonth(new Date(2026, 12, 1))).toBe('2027-01')
    expect(monthCells(new Date(2026, 10, 1))[0]).toBe('2026-11-01')
  })
})
