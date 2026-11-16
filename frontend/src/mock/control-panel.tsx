'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'

type Controls = { role: string; scenario: string; unhandled: string[] }

export function MockControlPanel() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Controls>({ role: 'admin', scenario: 'normal', unhandled: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/__mock', { signal: controller.signal }).then((r) => r.json()).then((r) => setSettings(r.data)).catch(() => {})
    return () => controller.abort()
  }, [])

  async function update(value: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/__mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
      if (!response.ok) throw new Error(t('Mock update failed'))
      // Recreate all query caches and simulated session state after changing a scenario.
      window.location.reload()
    } catch (cause) {
      setError((cause as Error).message)
      setBusy(false)
    }
  }

  return (
    <details className="mock-controls">
      <summary>{t('Mock workspace')}</summary>
      <div className="mock-controls-content">
        <p>{t('Local sample data. Changes reset when the server restarts.')}</p>
        <FilterSelect label={t('Preview role')} value={settings.role} disabled={busy} onChange={(role) => void update({ role })}
          options={[{ value: 'admin', label: t('Administrator') }, { value: 'user', label: t('User') }, { value: 'guest', label: t('Guest') }]} />
        <FilterSelect label={t('Data scenario')} value={settings.scenario} disabled={busy} onChange={(scenario) => void update({ scenario })}
          options={[{ value: 'normal', label: t('Normal data') }, { value: 'empty', label: t('Empty data') }, { value: 'error', label: t('Error response') }, { value: 'slow', label: t('Slow response') }]} />
        <Button variant="outline" disabled={busy} onClick={() => void update({ reset: true, scenario: 'normal', role: 'admin' })}>{t('Reset mock data')}</Button>
        <a href="/pricing">{t('Models')}</a>
        <a href="/dashboard/overview">{t('Overview')}</a>
        {error && <p role="alert">{error}</p>}
        {settings.unhandled.length > 0 && <details><summary>{t('Unimplemented mock endpoints')} ({settings.unhandled.length})</summary><pre>{settings.unhandled.join('\n')}</pre></details>}
      </div>
    </details>
  )
}
