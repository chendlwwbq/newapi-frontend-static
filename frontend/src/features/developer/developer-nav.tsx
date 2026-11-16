'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
export function DeveloperNav() {
  const path = usePathname(),
    { t } = useTranslation()
  return (
    <nav className="admin-subnav" aria-label={t('Developer content')}>
      {[
        ['/rest-apis', 'REST API definitions'],
        ['/developer-docs', 'Developer documentation'],
      ].map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
          {t(label)}
        </Link>
      ))}
    </nav>
  )
}
