'use client'
import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { SubscriptionPlan } from '@/features/wallet/subscription-types'

export const blankPlan: SubscriptionPlan = {
  id: 0,
  title: '',
  subtitle: '',
  price_amount: 0,
  currency: 'USD',
  duration_unit: 'month',
  duration_value: 1,
  custom_seconds: 86400,
  quota_reset_period: 'never',
  quota_reset_custom_seconds: 86400,
  enabled: false,
  sort_order: 0,
  allow_balance_pay: true,
  allow_wallet_overflow: true,
  max_purchase_per_user: 0,
  total_amount: 0,
  upgrade_group: '',
  downgrade_group: '',
  stripe_price_id: '',
  creem_product_id: '',
  waffo_pancake_product_id: '',
}
export function PlanEditor({ initial, unit, enabled, onClose }: { initial: SubscriptionPlan; unit: number; enabled: boolean; onClose: () => void }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [plan, setPlan] = useState(initial),
    [error, setError] = useState('')
  const save = useMutation({
    mutationFn: () => api(`/api/subscription/admin/plans${plan.id ? '/' + plan.id : ''}`, { method: plan.id ? 'PUT' : 'POST', body: { plan } }),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['admin-plans'] })
      void queries.invalidateQueries({ queryKey: ['subscription-plans'] })
      toast.success(t('Saved'))
      onClose()
    },
    onError: (error) => setError(error.message),
  })
  const patch = (next: Partial<SubscriptionPlan>) => setPlan((current) => ({ ...current, ...next }))
  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose()
      }}
    >
      <DialogContent className="admin-editor">
        <DialogHeader>
          <DialogTitle>{t(plan.id ? 'Edit subscription plan' : 'Create subscription plan')}</DialogTitle>
          <DialogDescription>{t('Configure subscription pricing, quota and renewal rules.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="admin-form-grid">
            <label className="field">
              <span>{t('Title')}</span>
              <input required maxLength={128} value={plan.title} onChange={(event) => patch({ title: event.target.value })} />
            </label>
            <label className="field">
              <span>{t('Subtitle')}</span>
              <input value={plan.subtitle || ''} onChange={(event) => patch({ subtitle: event.target.value })} />
            </label>
            <label className="field">
              <span>{t('Price')} (USD)</span>
              <input
                required
                type="number"
                min={0}
                max={9999}
                step="0.01"
                value={plan.price_amount}
                onChange={(event) => patch({ price_amount: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>{t('Quota')} (USD)</span>
              <input
                required
                type="number"
                min={0}
                step="0.000001"
                value={plan.total_amount / unit}
                onChange={(event) => patch({ total_amount: Math.round(Number(event.target.value) * unit) })}
              />
              <small className="small-note">{t('Zero means unlimited.')}</small>
            </label>
            <label className="field">
              <span>{t('Duration unit')}</span>
              <select
                value={plan.duration_unit}
                onChange={(event) => patch({ duration_unit: event.target.value as SubscriptionPlan['duration_unit'] })}
              >
                {[
                  ['year', 'Year'],
                  ['month', 'Month'],
                  ['day', 'Day'],
                  ['hour', 'Hour'],
                  ['custom', 'Custom'],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t(plan.duration_unit === 'custom' ? 'Duration in seconds' : 'Duration')}</span>
              <input
                required
                type="number"
                min={1}
                step={1}
                value={plan.duration_unit === 'custom' ? plan.custom_seconds : plan.duration_value}
                onChange={(event) =>
                  patch(
                    plan.duration_unit === 'custom' ? { custom_seconds: Number(event.target.value) } : { duration_value: Number(event.target.value) }
                  )
                }
              />
            </label>
            <label className="field">
              <span>{t('Quota reset period')}</span>
              <select
                value={plan.quota_reset_period}
                onChange={(event) => patch({ quota_reset_period: event.target.value as SubscriptionPlan['quota_reset_period'] })}
              >
                {[
                  ['never', 'Never'],
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly'],
                  ['monthly', 'Monthly'],
                  ['custom', 'Custom'],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            {plan.quota_reset_period === 'custom' && (
              <label className="field">
                <span>{t('Reset interval in seconds')}</span>
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={plan.quota_reset_custom_seconds}
                  onChange={(event) => patch({ quota_reset_custom_seconds: Number(event.target.value) })}
                />
              </label>
            )}
            <label className="field">
              <span>{t('Purchase limit per user')}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={plan.max_purchase_per_user}
                onChange={(event) => patch({ max_purchase_per_user: Number(event.target.value) })}
              />
              <small className="small-note">{t('Zero means unlimited.')}</small>
            </label>
            <label className="field">
              <span>{t('Sort order')}</span>
              <input type="number" step={1} value={plan.sort_order} onChange={(event) => patch({ sort_order: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>{t('Upgrade group')}</span>
              <input value={plan.upgrade_group || ''} onChange={(event) => patch({ upgrade_group: event.target.value })} />
            </label>
            <label className="field">
              <span>{t('Downgrade group')}</span>
              <input value={plan.downgrade_group || ''} onChange={(event) => patch({ downgrade_group: event.target.value })} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={plan.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
              {t('Enabled')}
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={plan.allow_balance_pay ?? true}
                onChange={(event) => patch({ allow_balance_pay: event.target.checked })}
              />
              {t('Allow balance payment')}
            </label>
            <label className="checkbox-label admin-wide">
              <input
                type="checkbox"
                checked={plan.allow_wallet_overflow ?? true}
                onChange={(event) => patch({ allow_wallet_overflow: event.target.checked })}
              />
              {t('Use wallet after subscription quota is exhausted')}
            </label>
          </div>
          <details className="admin-advanced">
            <summary>{t('Payment product IDs')}</summary>
            {(['stripe_price_id', 'creem_product_id', 'waffo_pancake_product_id'] as const).map((key) => (
              <label className="field" key={key}>
                <span>{key}</span>
                <input value={plan[key] || ''} onChange={(event) => patch({ [key]: event.target.value })} />
              </label>
            ))}
          </details>
          {error && (
            <p className="inline-error" role="alert">
              {t(error)}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={!enabled || save.isPending}>
              {t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
