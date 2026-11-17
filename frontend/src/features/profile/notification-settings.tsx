'use client'
import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import type { User } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrencyFormatter, useQuotaFormatter } from '@/lib/format'
import { notificationSettings, type NotificationSettings } from './preferences'

export function NotificationPreferences({ user, siteEnabled, siteThreshold }: { user: User; siteEnabled: boolean; siteThreshold: number }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    format = useQuotaFormatter(),
    currency = useCurrencyFormatter()
  const { config, meta } = currency.formatter.getCurrencyDisplay()
  const unitLabel = meta.kind === 'tokens' ? 'Tokens' : meta.symbol
  const [draft, setDraft] = useState(() => notificationSettings(user.setting))
  const save = useMutation({
    mutationFn: () => api('/api/user/setting', { method: 'PUT', body: draft }),
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: ['self'] })
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  function patch(next: Partial<NotificationSettings>) {
    setDraft((previous) => ({ ...previous, ...next }))
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }
  return (
    <form className="console-panel profile-preferences" onSubmit={submit}>
      <h2>{t('Settings & Preferences')}</h2>
      <label className="preference-switch">
        <span>
          {t('Low balance reminders')}
          <small>
            {t('System default')}: {siteEnabled ? t('Enabled') : t('Disabled')}
          </small>
        </span>
        <input type="checkbox" checked={draft.quota_warning_enabled ?? true} onChange={(e) => patch({ quota_warning_enabled: e.target.checked })} />
      </label>
      <label className="field">
        <span>{t('Notification method')}</span>
        <select value={draft.notify_type} onChange={(e) => patch({ notify_type: e.target.value as NotificationSettings['notify_type'] })}>
          {[
            ['email', 'Email'],
            ['webhook', 'Webhook'],
            ['bark', 'Bark'],
            ['gotify', 'Gotify'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {value === 'email' ? t(label) : label}
            </option>
          ))}
        </select>
      </label>
      {draft.notify_type === 'email' && (
        <label className="field">
          <span>{t('Notification email')}</span>
          <input
            type="email"
            placeholder={user.email || ''}
            value={draft.notification_email}
            onChange={(e) => patch({ notification_email: e.target.value })}
          />
        </label>
      )}
      {draft.notify_type === 'webhook' && (
        <>
          <label className="field">
            <span>{t('Webhook URL')}</span>
            <input required type="url" value={draft.webhook_url} onChange={(e) => patch({ webhook_url: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('Webhook Secret')}</span>
            <Input type="password" autoComplete="off" value={draft.webhook_secret} onChange={(e) => patch({ webhook_secret: e.target.value })} />
          </label>
        </>
      )}
      {draft.notify_type === 'bark' && (
        <label className="field">
          <span>{t('Bark URL')}</span>
          <input required type="url" value={draft.bark_url} onChange={(e) => patch({ bark_url: e.target.value })} />
        </label>
      )}
      {draft.notify_type === 'gotify' && (
        <>
          <label className="field">
            <span>{t('Gotify URL')}</span>
            <input required type="url" value={draft.gotify_url} onChange={(e) => patch({ gotify_url: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('Gotify Token')}</span>
            <Input required type="password" autoComplete="off" value={draft.gotify_token} onChange={(e) => patch({ gotify_token: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('Priority')}</span>
            <input
              type="number"
              min={0}
              max={10}
              value={draft.gotify_priority}
              onChange={(e) => patch({ gotify_priority: Number(e.target.value) })}
            />
          </label>
        </>
      )}
      <label className="field">
        <span>
          {t('Reminder threshold')} ({t('Raw quota')} · {unitLabel})
        </span>
        <input
          type="number"
          min={0}
          step="any"
          value={draft.quota_warning_threshold}
          onChange={(e) => patch({ quota_warning_threshold: Number(e.target.value) })}
        />
        <small className="tabular-nums font-mono">
          {currency.ready && draft.quota_warning_threshold > 0
            ? `≈ ${format(draft.quota_warning_threshold, { abbreviate: false })} · `
            : ''}
          {t('Zero uses the system default')}: {siteThreshold}
          {currency.ready ? ` (≈ ${format(siteThreshold, { abbreviate: false })})` : ''} · 1 USD ={' '}
          {config.quotaPerUnit.toLocaleString(currency.locale)} {t('Raw quota')}
        </small>
      </label>
      <label className="preference-switch">
        <span>{t('Record IP logs')}</span>
        <input type="checkbox" checked={draft.record_ip_log} onChange={(e) => patch({ record_ip_log: e.target.checked })} />
      </label>
      <label className="preference-switch">
        <span>{t('Accept models without configured pricing')}</span>
        <input
          type="checkbox"
          checked={draft.accept_unset_model_ratio_model}
          onChange={(e) => patch({ accept_unset_model_ratio_model: e.target.checked })}
        />
      </label>
      {user.role >= 10 && (
        <>
          <label className="preference-switch">
            <span>{t('Upstream model update notifications')}</span>
            <input
              type="checkbox"
              checked={draft.upstream_model_update_notify_enabled}
              onChange={(e) => patch({ upstream_model_update_notify_enabled: e.target.checked })}
            />
          </label>
          <label className="preference-switch">
            <span>{t('Channel notifications')}</span>
            <input
              type="checkbox"
              checked={draft.channel_notify_enabled ?? user.role === 100}
              onChange={(e) => patch({ channel_notify_enabled: e.target.checked })}
            />
          </label>
        </>
      )}
      <Button type="submit" loading={save.isPending}>
        {t('Save')}
      </Button>
    </form>
  )
}
