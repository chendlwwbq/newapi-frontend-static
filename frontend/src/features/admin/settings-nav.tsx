'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { settingsSections } from './settings-schema'

export function SettingsNav({ section }: { section: string }) {
  const { t } = useTranslation()
  return (
    <nav className="admin-subnav" aria-label={t('Settings')}>
      {Object.entries(settingsSections).map(([key, value]) => (
        <Link
          className="min-w-[4.5rem] px-3.5 text-center"
          href={`/system-settings/${key}`}
          key={key}
          aria-current={key === section ? 'page' : undefined}
        >
          {t(value.title)}
        </Link>
      ))}
    </nav>
  )
}
