'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
export function MetadataNav() {
  const path = usePathname(),
    { t } = useTranslation()
  return (
    <nav className="admin-subnav [&>a]:shrink-0" aria-label={t('Models')}>
      {[
        ['/models/metadata', 'Models'],
        ['/models/vendors', 'Vendors'],
        ['/models/deployments', 'Model deployments'],
        ['/models/prefill', 'Prefill groups'],
        ['/models/sync', 'Metadata sync'],
        ['/models/pricing', 'Model pricing'],
        ['/models/pricing-sync', 'Upstream price sync'],
        ['/system-settings/groups', 'Group settings'],
      ].map(([href, label]) => (
        <Link
          key={href}
          className="min-w-[4.5rem] px-3.5 text-center"
          href={href}
          aria-current={path === href ? 'page' : undefined}
          onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
        >
          {t(label)}
        </Link>
      ))}
    </nav>
  )
}
