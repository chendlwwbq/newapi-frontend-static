'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter, formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { MetricTrend } from '@/components/shared/metric-trend'

interface UserStatTrendBucket {
  bucket_start: number
  label: string
  count: number
}
interface UserStatGroupItem {
  key: string
  users: number
  quota: number
  used_quota: number
  requests: number
}
interface UserStatCountItem {
  key: string
  users: number
}
interface UserStatRankItem {
  id: number
  username: string
  display_name?: string
  quota?: number
  used_quota?: number
  created_at?: number
  last_login_at?: number
}

interface UserStatResponse {
  granularity: string
  summary: {
    total_users: number
    enabled_users: number
    disabled_users: number
    deleted_users: number
    total_quota: number
    total_used_quota: number
    total_granted_quota: number
    total_requests: number
    avg_quota: number
    avg_used_quota: number
    new_users_7d: number
    new_users_30d: number
    active_users_7d: number
    active_users_30d: number
  }
  signup_trend: UserStatTrendBucket[]
  active_trend: UserStatTrendBucket[]
  group_dim: UserStatGroupItem[]
  status_dim: UserStatCountItem[]
  role_dim: UserStatCountItem[]
  source_dim: UserStatCountItem[]
  top_balance: UserStatRankItem[]
  top_consumption: UserStatRankItem[]
  silent_users: UserStatRankItem[]
}

type StatGranularity = 'day' | 'week' | 'month'

const sourceKeys: Record<string, string> = {
  wechat: 'WeChat',
  github: 'GitHub',
  linux_do: 'Linux DO',
  discord: 'Discord',
  telegram: 'Telegram',
  oidc: 'OIDC',
  email: 'Email',
  username: 'Username',
}
const statusKeys: Record<string, string> = { enabled: 'Enabled', disabled: 'Disabled' }
const roleKeys: Record<string, string> = { root: 'Root', admin: 'Admin', user: 'User' }

function RankTable({
  title,
  items,
  value,
  t,
}: {
  title: string
  items: UserStatRankItem[]
  value: (item: UserStatRankItem) => string
  t: (key: string) => string
}) {
  return (
    <section className="console-panel">
      <h2>{t(title)}</h2>
      {items.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Username')}</th>
                <th>{t('Value')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.display_name || item.username} <code>{item.username}</code>
                  </td>
                  <td>{value(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t('No data yet')} />
      )}
    </section>
  )
}

export function UserStatsPanel() {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    money = useQuotaFormatter()
  const admin = (auth.bundle?.user.role || 0) >= 10
  const [granularity, setGranularity] = useState<StatGranularity>('day')
  const [trend, setTrend] = useState<'signup' | 'active'>('signup')
  const query = useQuery({
    queryKey: ['user-stat', granularity],
    enabled: admin,
    queryFn: ({ signal }) => api<UserStatResponse>(`/api/user/stat?granularity=${granularity}`, { signal }),
  })
  if (!admin) return null
  const stat = query.data
  const number = (value: number) => formatNumber(value, toIntlLocale(i18n.language))
  const date = (timestamp: number) =>
    new Intl.DateTimeFormat(toIntlLocale(i18n.language), { year: 'numeric', month: 'short', day: 'numeric' }).format(timestamp * 1000)
  const trendBuckets = trend === 'signup' ? stat?.signup_trend || [] : stat?.active_trend || []
  return (
    <section className="console-panel analytics-panel">
      <div className="analytics-heading">
        <h2>{t('User statistics')}</h2>
        <div className="analytics-actions">
          <select
            className="plain-select"
            aria-label={t('Select time granularity')}
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as StatGranularity)}
          >
            {(
              [
                ['day', 'Day'],
                ['week', 'Week'],
                ['month', 'Month'],
              ] as const
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
          <button className="icon-button" aria-label={t('Refresh')} onClick={() => void query.refetch()}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : !stat ? (
        <EmptyState title={t('No data yet')} />
      ) : (
        <>
          <div className="stat-grid">
            {(
              [
                ['Total users', number(stat.summary.total_users)],
                [
                  'Enabled',
                  `${number(stat.summary.enabled_users)} / ${t('Disabled')} ${number(stat.summary.disabled_users)} / ${t('Deleted')} ${number(stat.summary.deleted_users)}`,
                ],
                ['Total balance', money(stat.summary.total_quota)],
                ['Total consumed', money(stat.summary.total_used_quota)],
                ['Total granted', money(stat.summary.total_granted_quota)],
                ['Requests', number(stat.summary.total_requests)],
                ['Avg balance', money(Math.round(stat.summary.avg_quota))],
                ['Avg consumed', money(Math.round(stat.summary.avg_used_quota))],
                [
                  'New users',
                  `${t('Last {{count}} days', { count: 7 })} ${number(stat.summary.new_users_7d)} / ${t('Last {{count}} days', { count: 30 })} ${number(stat.summary.new_users_30d)}`,
                ],
                [
                  'Active users',
                  `${t('Last {{count}} days', { count: 7 })} ${number(stat.summary.active_users_7d)} / ${t('Last {{count}} days', { count: 30 })} ${number(stat.summary.active_users_30d)}`,
                ],
              ] as const
            ).map(([label, value]) => (
              <div className="stat-card" key={label}>
                <div>{t(label)}</div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="analytics-heading">
            <h3>{t(trend === 'signup' ? 'New user trend' : 'Active user trend')}</h3>
            <div className="analytics-actions">
              <select
                className="plain-select"
                aria-label={t('Trend')}
                value={trend}
                onChange={(event) => setTrend(event.target.value as 'signup' | 'active')}
              >
                <option value="signup">{t('New user trend')}</option>
                <option value="active">{t('Active user trend')}</option>
              </select>
            </div>
          </div>
          {trendBuckets.length ? (
            <MetricTrend
              points={trendBuckets.map((bucket) => ({ key: bucket.label, timestamp: bucket.bucket_start, value: bucket.count }))}
              format={number}
              date={(timestamp) => trendBuckets.find((bucket) => bucket.bucket_start === timestamp)?.label || ''}
              title={t('Usage trend')}
              selectionLabel={t('Usage trend')}
              controlsLabel={t('Usage trend')}
            />
          ) : (
            <EmptyState title={t('No data yet')} />
          )}

          <div className="console-columns">
            <section className="console-panel">
              <h2>{t('Group')}</h2>
              {stat.group_dim.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {['Group', 'Users', 'Balance', 'Consumed', 'Requests'].map((label) => (
                          <th key={label}>{t(label)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stat.group_dim.map((item) => (
                        <tr key={item.key}>
                          <td>
                            <code>{item.key}</code>
                          </td>
                          <td>{number(item.users)}</td>
                          <td>{money(item.quota)}</td>
                          <td>{money(item.used_quota)}</td>
                          <td>{number(item.requests)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title={t('No data yet')} />
              )}
            </section>
            {(
              [
                ['Status', stat.status_dim, statusKeys],
                ['Role', stat.role_dim, roleKeys],
                ['Registration source', stat.source_dim, sourceKeys],
              ] as const
            ).map(([title, items, keys]) => (
              <section className="console-panel" key={title}>
                <h2>{t(title)}</h2>
                {items.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th />
                          <th>{t('Users')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.key}>
                            <td>{t((keys as Record<string, string>)[item.key] || item.key)}</td>
                            <td>{number(item.users)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title={t('No data yet')} />
                )}
              </section>
            ))}
          </div>

          <div className="console-columns">
            <RankTable title="Top balance" items={stat.top_balance} value={(item) => money(item.quota || 0)} t={t} />
            <RankTable title="Top consumption" items={stat.top_consumption} value={(item) => money(item.used_quota || 0)} t={t} />
            <section className="console-panel">
              <h2>{t('Silent users')}</h2>
              {stat.silent_users.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {['Username', 'Registered', 'Last login', 'Consumed'].map((label) => (
                          <th key={label}>{t(label)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stat.silent_users.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {item.display_name || item.username} <code>{item.username}</code>
                          </td>
                          <td>{item.created_at ? date(item.created_at) : '—'}</td>
                          <td>{item.last_login_at ? date(item.last_login_at) : t('Never')}</td>
                          <td>{money(item.used_quota || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title={t('No data yet')} />
              )}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
