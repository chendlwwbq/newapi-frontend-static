'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, Package } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { useAuthStatus } from '@/features/auth/use-auth-status'
import { beginCheckout } from './lib/checkout'
import { subscriptionBalanceCost } from './lib/subscription-cost'
import type { PlanRecord, SelfSubscriptionData, SubscriptionPlan } from './subscription-types'
import type { TopupInfo } from './types'

const preferences = [
  ['subscription_first', 'Subscription First'],
  ['wallet_first', 'Wallet First'],
  ['subscription_only', 'Subscription Only'],
  ['wallet_only', 'Wallet Only'],
] as const

export function SubscriptionPanel({ info, quota }: { info: TopupInfo; quota: number }) {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    queries = useQueryClient(),
    format = useQuotaFormatter(),
    status = useAuthStatus()
  const userId = auth.bundle!.user.id
  const plans = useQuery({ queryKey: ['subscription-plans'], queryFn: () => api<PlanRecord[]>('/api/subscription/plans') })
  const self = useQuery({
    queryKey: ['subscriptions-self', userId],
    queryFn: () => api<SelfSubscriptionData>('/api/subscription/self'),
    refetchOnWindowFocus: true,
  })
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null),
    [method, setMethod] = useState('balance'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const planById = new Map(plans.data?.map((item) => [item.plan.id, item.plan]))
  const locale = toIntlLocale(i18n.language)
  const date = (seconds: number) => (seconds ? new Date(seconds * 1000).toLocaleDateString(locale) : '—')
  const price = (plan: SubscriptionPlan) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency || 'USD' }).format(plan.price_amount)
  const duration = (plan: SubscriptionPlan) =>
    `${plan.duration_unit === 'custom' ? plan.custom_seconds : plan.duration_value} ${t(plan.duration_unit === 'custom' ? 'seconds' : plan.duration_unit === 'year' ? 'years' : plan.duration_unit === 'month' ? 'months' : plan.duration_unit === 'day' ? 'days' : 'hours')}`
  function methods(plan: SubscriptionPlan) {
    if (!info.payment_compliance_confirmed) return []
    return [
      ...(plan.allow_balance_pay !== false ? [{ type: 'balance', name: t('Account balance') }] : []),
      ...(info.enable_stripe_topup && plan.stripe_price_id ? [{ type: 'stripe', name: 'Stripe' }] : []),
      ...(info.enable_creem_topup && plan.creem_product_id ? [{ type: 'creem', name: 'Creem' }] : []),
      ...(info.enable_waffo_pancake_topup && plan.waffo_pancake_product_id ? [{ type: 'waffo-pancake', name: 'Waffo Pancake' }] : []),
      ...(info.enable_online_topup ? info.pay_methods.filter((item) => !['stripe', 'creem', 'waffo', 'waffo_pancake'].includes(item.type)) : []),
    ]
  }
  async function preference(value: string) {
    setBusy(true)
    try {
      await api('/api/subscription/self/preference', { method: 'PUT', body: { billing_preference: value } })
      await queries.invalidateQueries({ queryKey: ['subscriptions-self', userId] })
      toast.success(t('Saved'))
    } catch (err) {
      toast.error(t((err as Error).message))
    } finally {
      setBusy(false)
    }
  }
  async function pay() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      if (method === 'balance') {
        await api('/api/subscription/balance/pay', { method: 'POST', body: { plan_id: selected.id } })
        await Promise.all([
          queries.invalidateQueries({ queryKey: ['self'] }),
          queries.invalidateQueries({ queryKey: ['subscriptions-self', userId] }),
        ])
        toast.success(t('Purchase successful'))
      } else {
        const provider = ['stripe', 'creem', 'waffo-pancake'].includes(method) ? method : 'epay'
        await beginCheckout(`/api/subscription/${provider}/pay`, { plan_id: selected.id, payment_method: method })
      }
      setSelected(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const balanceCost = selected && status.data?.quota_per_unit ? subscriptionBalanceCost(selected.price_amount, status.data.quota_per_unit) : null
  const purchaseCount = selected ? self.data?.all_subscriptions.filter((item) => item.subscription.plan_id === selected.id).length || 0 : 0
  const limitReached = !!selected?.max_purchase_per_user && purchaseCount >= selected.max_purchase_per_user
  return (
    <>
      <section className="console-panel">
        <div className="finance-title">
          <Package size={18} />
          <h2>{t('My subscriptions')}</h2>
          <label className="billing-preference">
            <span>{t('Billing preference')}</span>
            <select
              value={self.data?.billing_preference || 'subscription_first'}
              disabled={busy || !self.data?.subscriptions.length}
              onChange={(event) => preference(event.target.value)}
            >
              {preferences.map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {self.isPending ? (
          <LoadingState />
        ) : self.error ? (
          <ErrorState error={self.error} retry={() => void self.refetch()} />
        ) : !self.data?.all_subscriptions.length ? (
          <EmptyState />
        ) : (
          <div className="subscription-list">
            {self.data.all_subscriptions.map(({ subscription }) => (
              <article key={subscription.id} className="subscription-row">
                <div>
                  <strong>{planById.get(subscription.plan_id)?.title || `#${subscription.plan_id}`}</strong>
                  <p>
                    {date(subscription.start_time)} — {date(subscription.end_time)}
                  </p>
                </div>
                <div>
                  <span className="security-status" data-enabled={subscription.status === 'active'}>
                    {t(subscription.status === 'active' ? 'Active' : subscription.status === 'expired' ? 'Expired' : subscription.status)}
                  </span>
                  <p>
                    {t('Usage')}: {format(subscription.amount_used)} /{' '}
                    {subscription.amount_total > 0 ? format(subscription.amount_total) : t('Unlimited')}
                    {subscription.next_reset_time ? ` · ${t('Next reset')}: ${date(subscription.next_reset_time)}` : ''}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="console-panel">
        <h2>{t('Subscription plans')}</h2>
        {plans.isPending ? (
          <LoadingState />
        ) : plans.error ? (
          <ErrorState error={plans.error} retry={() => void plans.refetch()} />
        ) : !plans.data?.length ? (
          <EmptyState />
        ) : (
          <div className="subscription-plans">
            {plans.data.map(({ plan }, index) => (
              <article
                key={plan.id}
                className={`subscription-plan rounded-2xl transition-all duration-300 ${
                  index === 0 ? 'border-purple-500/50 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/20' : ''
                }`}
              >
                <span className="plan-eyebrow">{t('Subscription')}</span>
                <h3>{plan.title}</h3>
                <p>{plan.subtitle}</p>
                <div className="plan-price text-3xl font-bold tracking-tight tabular-nums font-mono">
                  {price(plan)}
                  <small>/ {duration(plan)}</small>
                </div>
                <ul>
                  <li>
                    <Check size={14} />
                    {t('Quota')}: {plan.total_amount > 0 ? format(plan.total_amount) : t('Unlimited')}
                  </li>
                  <li>
                    <Check size={14} />
                    {t('Reset period')}:{' '}
                    {t(
                      plan.quota_reset_period === 'never'
                        ? 'No Reset'
                        : plan.quota_reset_period === 'daily'
                          ? 'Daily'
                          : plan.quota_reset_period === 'weekly'
                            ? 'Weekly'
                            : plan.quota_reset_period === 'monthly'
                              ? 'Monthly'
                              : 'Custom'
                    )}{' '}
                    {plan.quota_reset_period === 'custom' ? `${plan.quota_reset_custom_seconds} ${t('seconds')}` : ''}
                  </li>
                  {plan.upgrade_group && (
                    <li>
                      <Check size={14} />
                      {t('Group')}: {plan.upgrade_group}
                    </li>
                  )}
                </ul>
                <Button
                  disabled={!methods(plan).length}
                  onClick={() => {
                    setSelected(plan)
                    setMethod(methods(plan)[0]?.type || '')
                    setError('')
                  }}
                >
                  {t('Subscribe')}
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null)
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t('Confirm Payment')}</DialogTitle>
            <DialogDescription>
              {selected?.title} · {selected && price(selected)} / {selected && duration(selected)}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <label className="field">
                <span>{t('Payment methods')}</span>
                <select value={method} disabled={busy} onChange={(event) => setMethod(event.target.value)}>
                  {methods(selected).map((item) => (
                    <option key={item.type} value={item.type}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {method === 'balance' && (
                <dl className="payment-summary">
                  <div>
                    <dt>{t('Cost')}</dt>
                    <dd>{balanceCost !== null ? format(balanceCost) : '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('Account balance')}</dt>
                    <dd>{format(quota)}</dd>
                  </div>
                </dl>
              )}
              {limitReached && <p className="inline-error">{t('Purchase limit for this plan has been reached')}</p>}
              {error && (
                <p role="alert" className="inline-error">
                  {t(error)}
                </p>
              )}
              <div className="security-actions">
                <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>
                  {t('Cancel')}
                </Button>
                <Button
                  disabled={
                    busy || limitReached || !methods(selected).length || (method === 'balance' && (balanceCost === null || quota < balanceCost))
                  }
                  onClick={pay}
                >
                  {t(busy ? 'Loading' : method === 'balance' ? 'Pay with balance' : 'Continue to payment')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
