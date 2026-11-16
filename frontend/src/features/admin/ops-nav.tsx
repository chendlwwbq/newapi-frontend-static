'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
export function OpsNav() {
  const path = usePathname(),
    { t } = useTranslation()
  return (
    <nav className="admin-subnav" aria-label={t('Operations')}>
      {[
        ['/ops/overview', 'Overview'],
        ['/ops/channels', 'Channel operations'],
        ['/ops/model-performance', 'Model performance'],
        ['/ops/affinity-cache', 'Affinity cache'],
        ['/ops/tasks', 'System tasks'],
        ['/ops/maintenance', 'Maintenance'],
      ].map(([href, label]) => (
        <Link href={href} key={href} aria-current={path === href ? 'page' : undefined}>
          {t(label)}
        </Link>
      ))}
    </nav>
  )
}
