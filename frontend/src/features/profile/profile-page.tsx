'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Link from 'next/link'
import { api } from '@/lib/api/client'
import type { User } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { NotificationPreferences } from './notification-settings'
import { CheckinCard } from './checkin-card'
import { SidebarPreferences } from './sidebar-preferences'

export function ProfilePage() {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    queries = useQueryClient(),
    money = useQuotaFormatter()
  const [name, setName] = useState<string | null>(null),
    [busy, setBusy] = useState(false)
  const query = useQuery({ queryKey: ['self', auth.bundle?.user.id], queryFn: () => api<User>('/api/user/self') })
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () =>
      api<{
        checkin_enabled?: boolean
        turnstile_check?: boolean
        turnstile_site_key?: string
        quota_remind_enabled?: boolean
        quota_remind_threshold?: number
      }>('/api/status'),
  })
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/api/user/self', { method: 'PUT', body: { username: query.data!.username, display_name: name ?? query.data!.display_name } })
      await queries.invalidateQueries({ queryKey: ['self'] })
      toast.success(t('Saved'))
    } catch (error) {
      toast.error(t((error as Error).message))
    } finally {
      setBusy(false)
    }
  }
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  if (!query.data) return <LoadingState />
  const user = query.data,
    locale = toIntlLocale(i18n.language)
  return (
    <div className="profile-page">
      <div className="console-page-heading">
        <div>
          <h1>{t('Profile')}</h1>
          <p>{t('Settings & Preferences')}</p>
        </div>
        <Link className="text-link" href="/security">
          {t('Security')} →
        </Link>
      </div>
      <section className="console-panel profile-summary">
        <span className="profile-avatar" aria-hidden="true">
          {(user.display_name || user.username).slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h2>{user.display_name || user.username}</h2>
          <p className="small-note">
            @{user.username} · ID {user.id} · {user.group}
          </p>
        </div>
        <dl>
          {[
            ['Account balance', money(user.quota)],
            ['Total usage', money(user.used_quota)],
            ['Requests', user.request_count.toLocaleString(locale)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{t(label)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="profile-columns">
        <div className="profile-main-column">
          <form className="console-panel" onSubmit={save}>
            <h2>{t('Account')}</h2>
            <label className="field">
              <span>{t('Username')}</span>
              <input value={user.username} readOnly autoComplete="username" />
            </label>
            <label className="field">
              <span>{t('Display name')}</span>
              <input maxLength={50} value={name ?? user.display_name ?? ''} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="profile-form-actions">
              <Button type="submit" disabled={busy}>
                {t(busy ? 'Loading' : 'Save')}
              </Button>
            </div>
          </form>
          <section className="console-panel">
            <h2>{t('Account Bindings')}</h2>
            <div className="binding-grid">
              <article>
                <div>
                  <strong>{t('Email')}</strong>
                  <p className="small-note">{user.email || t('Not bound')}</p>
                </div>
                <Link href="/security/bindings" className="pill-button secondary">
                  {t('Manage')} →
                </Link>
              </article>
            </div>
          </section>
          <NotificationPreferences
            key={`${user.id}:${user.setting}`}
            user={user}
            siteEnabled={status.data?.quota_remind_enabled !== false}
            siteThreshold={status.data?.quota_remind_threshold ?? 0}
          />
          <section className="console-panel profile-language">
            <div>
              <h2>{t('Language Preferences')}</h2>
              <p className="small-note">{t('Language preferences sync across your signed-in devices and affect API error messages.')}</p>
            </div>
            <LanguageSwitcher saveToAccount />
          </section>
        </div>
        <div className="profile-side-column">
          {status.data?.checkin_enabled && <CheckinCard siteKey={status.data.turnstile_check ? status.data.turnstile_site_key : undefined} />}
          {user.permissions?.sidebar_settings !== false && <SidebarPreferences key={`${user.id}:${user.sidebar_modules}`} user={user} />}
          <section className="console-panel">
            <h2>{t('Account')}</h2>
            <div className="settings-row">
              <span>{t('Status')}</span>
              <strong>{t(user.status === 2 ? 'Disabled' : 'Enabled')}</strong>
            </div>
            <div className="settings-row">
              <span>{t('Role')}</span>
              <strong>{t(user.role >= 10 ? 'Admin' : 'User')}</strong>
            </div>
            <Link href="/security" className="text-link">
              {t('Security')} →
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
