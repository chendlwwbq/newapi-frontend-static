'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import { api } from '@/lib/api/client'
import { compareSystemVersions } from './lib/system-releases'
import { useSystemRelease, useVersionIgnored } from './lib/system-update-state'

export function SystemUpdateNotice({ userId }: { userId: number }) {
  const { t } = useTranslation()
  const status = useQuery({ queryKey: ['status'], queryFn: ({ signal }) => api<{ version: string }>('/api/status', { signal }), staleTime: 60_000 })
  const release = useSystemRelease()
  const version = release.error ? undefined : release.data?.tag_name
  const ignored = useVersionIgnored(userId, version)
  if (ignored || compareSystemVersions(status.data?.version, version) !== -1) return null
  return (
    <Link
      className="console-catalog-link"
      href="/system-updates"
      title={t('New version available: {{version}}', { version })}
      aria-label={t('New version available: {{version}}', { version })}
    >
      <ArrowUpRight size={14} />
      {t('Update available')}
    </Link>
  )
}
