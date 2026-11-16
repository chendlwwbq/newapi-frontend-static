'use client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth/session'
import { AnalyticsPanel } from './analytics-panel'
import { LoadingState } from '@/components/shared/states'

const UserStatsPanel = dynamic(() => import('./user-stats-panel').then((module) => module.UserStatsPanel), { loading: () => <LoadingState /> })

export function AnalyticsPage({ view = 'models' }: { view?: 'models' | 'flow' | 'users' }) {
  const { t } = useTranslation()
  const { bundle } = useAuth()
  const admin = (bundle?.user.role || 0) >= 10
  const title = view === 'flow' ? 'Flow' : view === 'users' ? 'User Analytics' : 'Model analytics'
  const subtitle = view === 'users' ? 'Account overview, growth and consumption rankings.' : 'Explore requests, token usage and costs by model.'
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t(title)}</h1>
          <p>{t(subtitle)}</p>
        </div>
      </div>
      <nav className="analytics-actions" aria-label={t('Usage analytics')}>
        <Link href="/dashboard/models" aria-current={view === 'models' ? 'page' : undefined}>
          {t('Model analytics')}
        </Link>
        <Link href="/dashboard/flow" aria-current={view === 'flow' ? 'page' : undefined}>
          {t('Flow')}
        </Link>
        {admin && (
          <Link href="/dashboard/users" aria-current={view === 'users' ? 'page' : undefined}>
            {t('User Analytics')}
          </Link>
        )}
        <Link href="/dashboard/tasks">{t('Task analytics')}</Link>
      </nav>
      {view === 'users' && !admin ? (
        <p>{t('No permission to perform this action')}</p>
      ) : (
        <>
          {view === 'users' && <UserStatsPanel />}
          <AnalyticsPanel initialView={view} />
        </>
      )}
    </>
  )
}
