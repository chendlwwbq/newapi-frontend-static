'use client'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, ArrowRight, KeyRound, Wallet, FileText, Coins, ArrowLeftRight, Check, Terminal, ChevronUp, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { User, Catalog, PageResult, Token, QuotaData } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { CopyButton } from '@/components/shared/copy-button'
import { AnalyticsPanel } from './analytics-panel'
import { ConfiguredPanels } from './configured-panels'
import { apiExample, apiProtocols } from '@/features/docs/api-examples'
import { useGatewayAddress } from '@/features/docs/use-gateway-address'
import { recentUsageWindow } from './lib/analytics'

export function OverviewPage({ noticeContent }: { noticeContent?: ReactNode }) {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    money = useQuotaFormatter(),
    gateway = useGatewayAddress(),
    id = auth.bundle?.user.id
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    setCollapsed(id ? localStorage.getItem(`eva:onboarding:${id}`) === 'hidden' : false)
  }, [id])
  const self = useQuery({ queryKey: ['self', id], queryFn: () => api<User>('/api/user/self'), enabled: !!id })
  const catalog = useQuery({ queryKey: ['catalog-console', id], queryFn: () => api<Catalog>('/api/catalog/models?currency=CNY'), enabled: !!id })
  const keys = useQuery({
    queryKey: ['tokens', id, 'onboarding'],
    queryFn: () => api<PageResult<Token>>('/api/token/?p=1&page_size=1'),
    enabled: !!id,
  })
  const status = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => api<{ enable_data_export: boolean }>('/api/status', { signal, anonymous: true }),
    staleTime: 60_000,
  })
  const recent = useQuery({
    queryKey: ['overview-recent-usage', id],
    enabled: !!id && status.data?.enable_data_export === true,
    refetchInterval: 300_000,
    queryFn: ({ signal }) => {
      const range = recentUsageWindow(Math.floor(Date.now() / 1000))
      return api<QuotaData[] | null>(`/api/data/self?start_timestamp=${range.start}&end_timestamp=${range.end}`, { signal })
    },
  })
  const user = self.data || auth.bundle?.user
  if (!user) return null
  const model = catalog.data?.models.find((model) =>
    model.offerings
      .flatMap((offering) => offering.access.flatMap((access) => access.protocols))
      .some((protocol) => apiProtocols.some((item) => item.id === protocol))
  )
  const supported = new Set(model?.offerings.flatMap((offering) => offering.access.flatMap((access) => access.protocols)))
  const protocol = apiProtocols.find((item) => supported.has(item.id))
  const code = model && protocol && gateway.address ? apiExample(protocol.id, gateway.address, model.configured_model_id, false, 'curl') : ''
  const cost = recent.data?.reduce((total, row) => total + row.quota, 0) ?? 0
  const steps = [
    {
      href: '/keys?create=1',
      title: 'Create API key',
      description: 'Manage keys for your applications and services.',
      done: keys.data ? !!keys.data.total : undefined,
      Icon: KeyRound,
    },
    { href: '/wallet', title: 'Add funds', description: 'Keep enough balance before sending requests.', done: user.quota > 0, Icon: Wallet },
    {
      href: '/playground',
      title: 'Send a request',
      description: 'Use Playground or your client to verify the route.',
      done: user.request_count > 0,
      Icon: Terminal,
    },
  ]
  function toggleGuide() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(`eva:onboarding:${user!.id}`, next ? 'hidden' : 'visible')
  }
  return (
    <div className="overview-page">
      <div className="console-page-heading">
        <h1>{t('Overview')}</h1>
        <Link className="text-link" href="/docs">
          {t('Docs')}
          <ArrowUpRight size={13} />
        </Link>
      </div>
      <div className="overview-start-grid">
        <section className="console-panel overview-guide">
          <div className="overview-guide-main">
            <span className="small-note">{t('Start building')}</span>
            <h2>{t('Start using your API gateway in minutes')}</h2>
            <p>{t('Your API gateway at a glance.')}</p>
            <div className="overview-guide-actions">
              <Button variant="outline" size="sm" onClick={toggleGuide}>
                {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />} {t(collapsed ? 'Show setup guide' : 'Hide setup guide')}
              </Button>
              <Link className="pill-button" href="/keys?create=1">
                <KeyRound size={13} />
                {t('Create API key')}
              </Link>
            </div>
            {!collapsed && (
              <ol className="overview-steps">
                {steps.map((step, index) => (
                  <li key={step.href}>
                    <span
                      className="overview-step-check"
                      data-done={step.done}
                      aria-label={t(step.done === undefined ? (keys.isPending ? 'Loading' : 'Unavailable') : step.done ? 'Completed' : 'Pending')}
                    >
                      {step.done && <Check size={12} />}
                    </span>
                    <Link href={step.href}>
                      <step.Icon size={17} />
                      <div>
                        <strong>
                          {index + 1}. {t(step.title)}
                        </strong>
                        <small>{t(step.description)}</small>
                      </div>
                      <ArrowRight size={15} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="overview-first-request">
            <div className="profile-section-heading">
              <div>
                <Terminal size={15} />
                <strong>{t('Make your first request')}</strong>
              </div>
              <Link href="/docs/api">{t('Docs')} ↗</Link>
            </div>
            {gateway.error ? (
              <ErrorState error={gateway.error} retry={gateway.retry} />
            ) : catalog.error ? (
              <ErrorState error={catalog.error} retry={() => catalog.refetch()} />
            ) : code ? (
              <div className="code-preview">
                <div>
                  <span className="terminal-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <CopyButton value={code} />
                </div>
                <pre>{code}</pre>
              </div>
            ) : (
              <EmptyState title={t(catalog.isPending ? 'Loading' : 'No models available')} />
            )}
            <p className="small-note">{t('Examples are not executed. Set NEW_API_KEY in your environment before running them.')}</p>
            <dl>
              {[
                ['API keys', keys.data ? String(keys.data.total) : '—'],
                ['Authentication', 'API key'],
                ['Model', model?.configured_model_id || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{t(label)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {keys.error && <ErrorState error={keys.error} retry={() => keys.refetch()} />}
          </div>
        </section>
        <section className="console-panel overview-suggestions">
          <span className="small-note">{t('Recommended actions')}</span>
          <h2>{t('Keep your platform ready')}</h2>
          {[
            ['/keys', 'API keys', 'Manage keys for your applications and services.', KeyRound],
            ['/usage-logs/common', 'Usage logs', 'Review requests, errors and billing details.', FileText],
            ['/pricing', 'Pricing', 'Compare model prices before sending traffic.', Coins],
          ].map(([href, label, description, Icon]) => {
            const Graphic = Icon as typeof KeyRound
            return (
              <Link key={href as string} href={href as string}>
                <Graphic size={18} />
                <div>
                  <strong>{t(label as string)}</strong>
                  <small>{t(description as string)}</small>
                </div>
                <ArrowRight size={13} />
              </Link>
            )
          })}
        </section>
      </div>
      <section className="console-panel overview-usage">
        <div className="overview-usage-main">
          <h2>{t('Usage overview')}</h2>
          <p>{t('Monitor balance, usage and requests')}</p>
          <div className="overview-stats">
            {[
              [
                t('Last 24 hours'),
                status.error || status.data?.enable_data_export !== true || recent.isPending || recent.error ? '—' : money(cost),
                Coins,
              ],
              [t('Total usage'), money(user.used_quota), Wallet],
              [t('Requests'), user.request_count.toLocaleString(toIntlLocale(i18n.language)), ArrowLeftRight],
            ].map(([label, value, Icon]) => {
              const Graphic = Icon as typeof Wallet
              return (
                <article key={label as string}>
                  <span>
                    <Graphic size={13} />
                    {label as string}
                  </span>
                  <strong>{value as string}</strong>
                  <i aria-hidden="true" />
                </article>
              )
            })}
          </div>
          {recent.error && <ErrorState error={recent.error} retry={() => recent.refetch()} />}
          {!status.error && (
            <small className="small-note">
              {status.data?.enable_data_export === false
                ? `${t('Data Dashboard')}: ${t('Disabled')}`
                : t('Latest 24 hourly buckets, including the current partial hour. Data may be delayed.')}
            </small>
          )}
        </div>
        <aside>
          <span className="small-note">{t('Account balance')}</span>
          <strong>{money(user.quota)}</strong>
          <span className={`status-badge ${user.quota > 0 ? 'success' : ''}`}>{t(user.quota > 0 ? 'Available' : 'Insufficient balance')}</span>
          <Link className="pill-button" href="/wallet">
            {t('Wallet')}
            <ArrowRight size={15} />
          </Link>
        </aside>
      </section>
      <ConfiguredPanels />
      <div className="console-columns">
        <AnalyticsPanel compact />
        <section className="console-panel">
          <h2>{t('News')}</h2>
          {noticeContent || <EmptyState />}
          <Link className="text-link" href="/news">
            {t('All news')} →
          </Link>
        </section>
      </div>
    </div>
  )
}
