'use client'
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import type { PlanRecord, SubscriptionPlan, UserSubscriptionRecord } from '@/features/wallet/subscription-types'
import { AdminConfirm } from './shared'
import { PlanEditor, blankPlan } from './plan-editor'

interface Action {
  path: string
  method: string
  body?: unknown
  label: string
  detail: string
}
export function SubscriptionsPage() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    format = useQuotaFormatter(),
    locale = toIntlLocale(i18n.language)
  const [editor, setEditor] = useState<SubscriptionPlan | null>(null),
    [action, setAction] = useState<Action | null>(null),
    [search, setSearch] = useState(''),
    [userId, setUserId] = useState(0),
    [planId, setPlanId] = useState('')
  const status = useQuery({ queryKey: ['status'], queryFn: () => api<{ quota_per_unit: number }>('/api/status') }),
    unit = status.data?.quota_per_unit
  const info = useQuery({
      queryKey: ['topup-info', bundle?.user.id],
      queryFn: () => api<{ payment_compliance_confirmed: boolean }>('/api/user/topup/info'),
    }),
    enabled = info.data?.payment_compliance_confirmed === true
  const plans = useQuery({ queryKey: ['admin-plans', bundle?.user.id], queryFn: () => api<PlanRecord[]>('/api/subscription/admin/plans') })
  const subscriptions = useQuery({
    queryKey: ['admin-user-subscriptions', bundle?.user.id, userId],
    enabled: userId > 0,
    queryFn: () => api<UserSubscriptionRecord[]>(`/api/subscription/admin/users/${userId}/subscriptions`),
  })
  const mutation = useMutation({
    mutationFn: (request: Action) => api(request.path, request),
    onSuccess: () => {
      setAction(null)
      void queries.invalidateQueries({ queryKey: ['admin-plans'] })
      void queries.invalidateQueries({ queryKey: ['admin-user-subscriptions'] })
      void queries.invalidateQueries({ queryKey: ['subscriptions-self'] })
      void queries.invalidateQueries({ queryKey: ['subscription-plans'] })
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const date = (seconds: number) => (seconds ? new Date(seconds * 1000).toLocaleString(locale) : '—')
  function lookup(event: FormEvent) {
    event.preventDefault()
    setUserId(Number(search))
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Subscriptions')}</h1>
          <p>{t('Configure subscription pricing, quota and renewal rules.')}</p>
        </div>
        <Button disabled={!enabled || !unit} onClick={() => setEditor({ ...blankPlan })}>
          <Plus size={14} />
          {t('Create subscription plan')}
        </Button>
      </div>
      {info.data && !enabled && (
        <p className="admin-notice">
          {t(
            'Payment, redemption, subscription, and invitation reward features are disabled. The administrator must confirm compliance terms before enabling them.'
          )}
        </p>
      )}
      {info.error && <ErrorState error={info.error} retry={() => info.refetch()} />}
      {plans.error ? (
        <ErrorState error={plans.error} retry={() => plans.refetch()} />
      ) : plans.isPending ? (
        <LoadingState />
      ) : !plans.data.length ? (
        <EmptyState />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {['Title', 'Price', 'Quota', 'Duration', 'Quota reset period', 'Status', 'Actions'].map((label) => (
                  <th key={label}>{t(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.data.map(({ plan }) => (
                <tr key={plan.id}>
                  <td>
                    <strong>{plan.title}</strong>
                    <div className="small-note">
                      #{plan.id} · {plan.subtitle}
                    </div>
                  </td>
                  <td>{new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency }).format(plan.price_amount)}</td>
                  <td>{plan.total_amount === 0 ? '∞' : format(plan.total_amount)}</td>
                  <td>
                    {plan.duration_unit === 'custom'
                      ? `${plan.custom_seconds} ${t('Seconds')}`
                      : `${plan.duration_value} ${t({ year: 'Year', month: 'Month', day: 'Day', hour: 'Hour' }[plan.duration_unit])}`}
                  </td>
                  <td>{t({ never: 'Never', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', custom: 'Custom' }[plan.quota_reset_period])}</td>
                  <td>
                    <span className={`status-badge ${plan.enabled ? 'success' : ''}`}>{t(plan.enabled ? 'Enabled' : 'Disabled')}</span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Button variant="ghost" size="icon" disabled={!unit} aria-label={`${t('Edit')} ${plan.title}`} onClick={() => setEditor(plan)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!enabled || mutation.isPending}
                        aria-label={t(plan.enabled ? 'Disable' : 'Enable')}
                        onClick={() =>
                          mutation.mutate({
                            path: `/api/subscription/admin/plans/${plan.id}`,
                            method: 'PATCH',
                            body: { enabled: !plan.enabled },
                            label: '',
                            detail: '',
                          })
                        }
                      >
                        <Power size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!enabled}
                        aria-label={`${t('Reset subscription usage')} ${plan.title}`}
                        onClick={() =>
                          setAction({
                            path: `/api/subscription/admin/plans/${plan.id}/subscriptions/reset`,
                            method: 'POST',
                            body: { advance_reset_time: false },
                            label: 'Reset subscription usage',
                            detail: plan.title,
                          })
                        }
                      >
                        <RotateCcw size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="console-panel" style={{ marginTop: 30 }}>
        <div className="analytics-heading">
          <h2>{t('User subscriptions')}</h2>
        </div>
        <form className="console-toolbar" onSubmit={lookup}>
          <label className="field">
            <span>{t('User ID')}</span>
            <input required type="number" min={1} step={1} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <Button type="submit" variant="outline">
            {t('Search')}
          </Button>
        </form>
        {userId > 0 && (
          <>
            <form
              className="console-toolbar"
              onSubmit={(event) => {
                event.preventDefault()
                setAction({
                  path: `/api/subscription/admin/users/${userId}/subscriptions`,
                  method: 'POST',
                  body: { plan_id: Number(planId) },
                  label: 'Grant subscription',
                  detail: `#${userId} · ${plans.data?.find(({ plan }) => plan.id === Number(planId))?.plan.title || ''}`,
                })
              }}
            >
              <label className="field">
                <span>{t('Subscription plan')}</span>
                <select required value={planId} onChange={(event) => setPlanId(event.target.value)}>
                  <option value="">{t('Select')}</option>
                  {plans.data?.map(({ plan }) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={!enabled || !planId}>
                {t('Grant subscription')}
              </Button>
            </form>
            {subscriptions.isPending ? (
              <LoadingState />
            ) : subscriptions.error ? (
              <ErrorState error={subscriptions.error} retry={() => subscriptions.refetch()} />
            ) : !subscriptions.data?.length ? (
              <EmptyState />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['Subscription plan', 'Status', 'Quota', 'Total usage', 'Expiry', 'Actions'].map((label) => (
                        <th key={label}>{t(label)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.data.map(({ subscription: sub }) => (
                      <tr key={sub.id}>
                        <td>
                          #{sub.id} · {plans.data?.find(({ plan }) => plan.id === sub.plan_id)?.plan.title || `#${sub.plan_id}`}
                        </td>
                        <td>{sub.status}</td>
                        <td>{sub.amount_total === 0 ? '∞' : format(sub.amount_total)}</td>
                        <td>{format(sub.amount_used)}</td>
                        <td className="small-note">{date(sub.end_time)}</td>
                        <td>
                          <div className="action-buttons">
                            {sub.status === 'active' && (
                              <Button
                                variant="outline"
                                disabled={!enabled}
                                onClick={() =>
                                  setAction({
                                    path: `/api/subscription/admin/user_subscriptions/${sub.id}/invalidate`,
                                    method: 'POST',
                                    label: 'Invalidate subscription',
                                    detail: `#${userId} / #${sub.id}`,
                                  })
                                }
                              >
                                {t('Invalidate')}
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              onClick={() =>
                                setAction({
                                  path: `/api/subscription/admin/user_subscriptions/${sub.id}`,
                                  method: 'DELETE',
                                  label: 'Delete subscription',
                                  detail: `#${userId} / #${sub.id}`,
                                })
                              }
                            >
                              {t('Delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
      {editor && unit && <PlanEditor initial={editor} unit={unit} enabled={enabled} onClose={() => setEditor(null)} />}
      {action && (
        <AdminConfirm
          title={t(action.label)}
          description={action.detail}
          busy={mutation.isPending}
          onClose={() => setAction(null)}
          onConfirm={() => mutation.mutate(action)}
        />
      )}
    </>
  )
}
