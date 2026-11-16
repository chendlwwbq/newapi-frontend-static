'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import type { User } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { parseSidebarModulesAdmin, updateNavigationModule } from '@/components/layout/navigation-config'

const sections = [
  {
    key: 'chat',
    title: 'Chat Area',
    items: [
      ['playground', 'Playground'],
      ['chat', 'Chat'],
    ],
  },
  {
    key: 'console',
    title: 'Console Area',
    items: [
      ['detail', 'Dashboard'],
      ['token', 'API keys'],
      ['log', 'Usage logs'],
      ['audit', 'Audit logs'],
      ['midjourney', 'Drawing Logs'],
      ['task', 'Task logs'],
    ],
  },
  {
    key: 'personal',
    title: 'Personal Center Area',
    items: [
      ['topup', 'Wallet'],
      ['personal', 'Profile'],
      ['security', 'Security'],
    ],
  },
  {
    key: 'admin',
    title: 'Admin',
    items: [
      ['channel', 'Channels'],
      ['models', 'Models'],
      ['user', 'Users'],
      ['redemption', 'Redemption codes'],
      ['subscription', 'Subscriptions'],
    ],
  },
]
export function SidebarPreferences({ user }: { user: User }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [draft, setDraft] = useState(user.sidebar_modules || '{}')
  const config = parseSidebarModulesAdmin(draft)
  const save = useMutation({
    mutationFn: () => api('/api/user/self', { method: 'PUT', body: { sidebar_modules: draft } }),
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: ['self'] })
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  return (
    <section className="console-panel profile-sidebar-preferences">
      <h2>{t('Sidebar Personal Settings')}</h2>
      <p className="small-note">{t('Customize sidebar display content')}</p>
      {sections
        .filter((section) => section.key !== 'admin' || user.role >= 10)
        .map((section) => (
          <fieldset key={section.key}>
            <legend>{t(section.title)}</legend>
            <label className="preference-switch">
              <span>{t('Enabled')}</span>
              <input
                type="checkbox"
                checked={config[section.key]?.enabled !== false}
                onChange={(e) => setDraft(updateNavigationModule(draft, 'SidebarModulesAdmin', section.key, e.target.checked, 'enabled'))}
              />
            </label>
            {section.items.map(([key, label]) => (
              <label className="preference-switch" key={key}>
                <span>{t(label)}</span>
                <input
                  type="checkbox"
                  disabled={config[section.key]?.enabled === false}
                  checked={config[section.key]?.[key] !== false}
                  onChange={(e) => setDraft(updateNavigationModule(draft, 'SidebarModulesAdmin', section.key, e.target.checked, key))}
                />
              </label>
            ))}
          </fieldset>
        ))}
      <div className="action-buttons">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {t(save.isPending ? 'Loading' : 'Save')}
        </Button>
        <Button variant="outline" onClick={() => setDraft('{}')}>
          {t('Reset')}
        </Button>
      </div>
    </section>
  )
}
