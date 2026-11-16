'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { api } from '@/lib/api/client'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { ContentPreview } from '@/components/shared/content-preview'
import { compareSystemVersions, parseSystemVersion } from './lib/system-releases'
import { setVersionIgnored, useSystemRelease, useVersionIgnored } from './lib/system-update-state'
import { useAuth } from '@/lib/auth/session'

export function SystemUpdates() {
  const { t, i18n } = useTranslation()
  const userId = useAuth().bundle!.user.id
  const status = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => api<{ version: string; start_time: number }>('/api/status', { signal }),
    staleTime: 60_000,
  })
  const releases = useSystemRelease()
  const release = releases.error ? undefined : releases.data,
    comparison = compareSystemVersions(status.data?.version, release?.tag_name)
  const version = release?.tag_name,
    releaseURL = version ? `https://github.com/QuantumNous/new-api/releases/tag/${encodeURIComponent(version)}` : ''
  const ignored = useVersionIgnored(userId, version)
  return (
    <>
      <div className="console-page-heading">
        <h1>{t('System updates')}</h1>
        <Button
          variant="outline"
          disabled={releases.isFetching}
          onClick={() => {
            void releases.refetch()
            void status.refetch()
          }}
        >
          <RefreshCw size={14} />
          {t(releases.isFetching ? 'Checking updates...' : 'Check again')}
        </Button>
      </div>
      <section className="console-panel">
        <dl className="settings-list">
          <div className="settings-row">
            <span>{t('Current version')}</span>
            <strong>{status.data?.version || t('Unknown version')}</strong>
          </div>
          <div className="settings-row">
            <span>{t('Uptime since')}</span>
            <strong>
              {status.data?.start_time ? new Date(status.data.start_time * 1000).toLocaleString(toIntlLocale(i18n.language), { hour12: false }) : '—'}
            </strong>
          </div>
          <div className="settings-row">
            <span>{t('Latest version')}</span>
            <strong>
              {version || t('Unknown')}
              {release && (release.prerelease || (parseSystemVersion(release.tag_name)?.stage ?? 3) < 3) ? ` · ${t('Pre-release')}` : ''}
            </strong>
          </div>
        </dl>
        {status.error && (
          <ErrorState
            error={status.error}
            retry={() => {
              void status.refetch()
            }}
          />
        )}
        {releases.isPending ? (
          <LoadingState />
        ) : releases.error ? (
          <ErrorState
            error={new Error('Failed to check for updates')}
            retry={() => {
              void releases.refetch()
            }}
          />
        ) : (
          <p role="status">
            {release
              ? comparison === -1
                ? t('New version available: {{version}}', { version })
                : comparison === null
                  ? ''
                  : t('No newer version available.')
              : t('No releases found.')}
          </p>
        )}
        {releaseURL && (
          <a href={releaseURL} target="_blank" rel="noopener noreferrer" className="text-link">
            {t('Go to GitHub')} ↗
          </a>
        )}
        {version && (comparison === -1 || ignored) && (
          <Button variant="ghost" onClick={() => setVersionIgnored(userId, version, !ignored)}>
            {t(ignored ? 'Restore notifications' : 'Ignore this version')}
          </Button>
        )}
        {release?.body ? <ContentPreview source={release.body} /> : release && <p className="small-note">{t('No release notes provided.')}</p>}
      </section>
    </>
  )
}
