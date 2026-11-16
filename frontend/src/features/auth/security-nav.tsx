'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
export function SecurityNav() {
  const path = usePathname(),
    { t } = useTranslation()
  return (
    <nav className="admin-subnav" aria-label={t('Security')}>
      {[
        ['/security', 'Security'],
        ['/security/bindings', 'Account Bindings'],
        ['/security/access-tokens', 'Access Tokens'],
      ].map(([href, label]) => (
        <Link className="min-w-[4.5rem] px-3.5 text-center" href={href} key={href} aria-current={path === href ? 'page' : undefined}>
          {t(label)}
        </Link>
      ))}
    </nav>
  )
}
