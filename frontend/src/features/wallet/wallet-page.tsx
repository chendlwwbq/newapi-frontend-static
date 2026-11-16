'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs } from '@base-ui/react/tabs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ReceiptText } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { formatNumber, useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { normalizeTopupInfo } from './lib/topup-info'
import { RechargePanel } from './recharge-panel'
import { SubscriptionPanel } from './subscription-panel'
import { AffiliatePanel } from './affiliate-panel'
import { OrderHistory } from './order-history'
import type { TopupInfo, UserWalletData } from './types'

const tabs = [
  ['recharge', 'Recharge'],
  ['subscriptions', 'Subscriptions'],
  ['invitations', 'Invitations'],
  ['orders', 'Orders'],
] as const
type Tab = (typeof tabs)[number][0]

export function WalletPage() {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    format = useQuotaFormatter(),
    queries = useQueryClient(),
    searchParams = useSearchParams()
  const requestedTab = searchParams?.get('tab')
  const initialTab: Tab = requestedTab && tabs.some(([value]) => value === requestedTab) ? (requestedTab as Tab) : 'recharge'
  const [tab, setTab] = useState<Tab>(initialTab)
  useEffect(() => {
    if (requestedTab && tabs.some(([value]) => value === requestedTab)) {
      setTab(requestedTab as Tab)
    }
  }, [requestedTab])
  const userId = auth.bundle!.user.id
  const self = useQuery({ queryKey: ['self', userId], queryFn: () => api<UserWalletData>('/api/user/self'), refetchOnWindowFocus: true })
  const info = useQuery({ queryKey: ['topup-info', userId], queryFn: async () => normalizeTopupInfo(await api<TopupInfo>('/api/user/topup/info')) })
  async function refresh() {
    await Promise.all([
      queries.invalidateQueries({ queryKey: ['self', userId] }),
      queries.invalidateQueries({ queryKey: ['topup-info', userId] }),
      queries.invalidateQueries({ queryKey: ['topup-orders', userId] }),
      queries.invalidateQueries({ queryKey: ['subscription-plans'] }),
      queries.invalidateQueries({ queryKey: ['subscriptions-self', userId] }),
    ])
  }
  let content = null
  if (tab === 'orders') content = <OrderHistory />
  else if (self.error && !self.data) content = null
  else if (info.error && !info.data) content = <ErrorState error={info.error} retry={() => void info.refetch()} />
  else if (info.isPending || !self.data) content = <LoadingState />
  else if (info.data) {
    if (tab === 'recharge')
      content = <RechargePanel info={info.data} affiliate={<AffiliatePanel user={self.data} enabled={!!info.data.payment_compliance_confirmed} />} />
    else if (tab === 'subscriptions') content = <SubscriptionPanel info={info.data} quota={self.data.quota} />
    else content = <AffiliatePanel user={self.data} enabled={!!info.data.payment_compliance_confirmed} />
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Wallet')}</h1>
          <p>{t('Manage account credit, subscriptions and payment history.')}</p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw size={14} />
          {t('Refresh')}
        </Button>
      </div>
      <section className="wallet-stats">
        <div className="wallet-balance">
          <span>{t('Available balance')}</span>
          <strong>{self.data ? format(self.data.quota) : '—'}</strong>
        </div>
        <Button className="wallet-orders" variant="outline" onClick={() => setTab('orders')}>
          <ReceiptText size={14} />
          {t('Orders')}
        </Button>
        <div className="wallet-summary">
          <div>
            <span>{t('Total usage')}</span>
            <strong>{self.data ? format(self.data.used_quota) : '—'}</strong>
          </div>
          <div>
            <span>{t('Requests')}</span>
            <strong>
              {self.data && Number.isFinite(self.data.request_count)
                ? formatNumber(self.data.request_count, toIntlLocale(i18n.resolvedLanguage || i18n.language))
                : '—'}
            </strong>
          </div>
          <div>
            <span>{t('Available rewards')}</span>
            <strong>{self.data ? format(self.data.aff_quota) : '—'}</strong>
          </div>
        </div>
      </section>
      {self.error && <ErrorState error={self.error} retry={() => void self.refetch()} />}
      <Tabs.Root value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <Tabs.List className="finance-tabs" aria-label={t('Wallet')}>
          {tabs.map(([value, label]) => (
            <Tabs.Tab key={value} value={value}>
              {t(label)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value={tab}>{content}</Tabs.Panel>
      </Tabs.Root>
    </>
  )
}
