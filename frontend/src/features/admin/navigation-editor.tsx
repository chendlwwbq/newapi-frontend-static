'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { parseHeaderNavModules, parseSidebarModulesAdmin, updateNavigationModule } from '@/components/layout/navigation-config'
import { isRecord } from './lib/settings-collections'

const headerLabels: Record<string, string> = {
  home: 'Home',
  console: 'Console',
  pricing: 'Model catalog',
  rankings: 'Rankings',
  docs: 'Docs',
  about: 'About',
}
const sidebarLabels: Record<string, string> = {
  chat: 'Chat area',
  console: 'Console area',
  personal: 'Personal area',
  admin: 'Admin area',
  playground: 'Playground',
  detail: 'Dashboard',
  token: 'API keys',
  log: 'Usage logs',
  audit: 'Audit logs',
  midjourney: 'Drawing logs',
  task: 'Task logs',
  topup: 'Wallet',
  security: 'Security',
  channel: 'Channels',
  models: 'Models',
  redemption: 'Redemption codes',
  user: 'Users',
  setting: 'Settings',
  subscription: 'Subscriptions',
}

export function NavigationEditor({ optionKey, value, onChange }: { optionKey: string; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation(),
    [raw, setRaw] = useState(false)
  let parsed: Record<string, unknown> | null = null
  try {
    const json: unknown = JSON.parse(value || '{}')
    if (isRecord(json)) parsed = json
  } catch {
    /* Preserve invalid JSON for direct repair. */
  }
  const header = parseHeaderNavModules(value),
    sidebar = parseSidebarModulesAdmin(value)
  function change(module: string, checked: boolean, nested?: string) {
    onChange(updateNavigationModule(value, optionKey, module, checked, nested))
  }
  return (
    <div className="settings-collection">
      <div className="settings-collection-toolbar">
        <Button type="button" size="sm" variant="outline" disabled={!parsed} onClick={() => setRaw((previous) => !previous)}>
          {t(raw || !parsed ? 'Visual editor' : 'Raw JSON')}
        </Button>
        <small className="small-note">{t('Hidden navigation does not change API permissions. Direct links still use server authorization.')}</small>
      </div>
      {raw || !parsed ? (
        <Textarea
          rows={10}
          aria-label={t(optionKey === 'HeaderNavModules' ? 'Header navigation' : 'Sidebar modules')}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <div className="settings-navigation-grid">
          {optionKey === 'HeaderNavModules'
            ? Object.entries(headerLabels).map(([module, label]) => (
                <section key={module} className="settings-collection-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={typeof header[module] === 'boolean' ? header[module] : header[module].enabled}
                      onChange={(event) => change(module, event.target.checked, ['pricing', 'rankings'].includes(module) ? 'enabled' : undefined)}
                    />
                    {t(label)}
                  </label>
                  {['pricing', 'rankings'].includes(module) && (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={typeof header[module] !== 'boolean' && header[module].requireAuth}
                        onChange={(event) => change(module, event.target.checked, 'requireAuth')}
                      />
                      {t('Require login')}
                    </label>
                  )}
                </section>
              ))
            : Object.entries(sidebar).map(([section, config]) => (
                <section className="settings-collection-row" key={section}>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={config.enabled} onChange={(event) => change(section, event.target.checked, 'enabled')} />
                    <strong>{t(sidebarLabels[section] || section)}</strong>
                  </label>
                  {Object.entries(config)
                    .filter(([module]) => module !== 'enabled')
                    .map(([module, enabled]) => (
                      <label className="checkbox-label" key={module}>
                        <input type="checkbox" checked={enabled} onChange={(event) => change(section, event.target.checked, module)} />
                        {t(module === 'personal' ? 'Profile' : module === 'chat' ? 'Chat' : sidebarLabels[module] || module)}
                      </label>
                    ))}
                </section>
              ))}
        </div>
      )}
    </div>
  )
}
