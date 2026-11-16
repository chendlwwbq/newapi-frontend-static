'use client'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CreditCard, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { toIntlLocale } from '@/i18n/languages'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorState } from '@/components/shared/states'
import { availablePaymentMethods, beginCheckout, topupEndpoint } from './lib/checkout'
import { generatePresetAmounts } from './lib/payment'
import type { CreemProduct, TopupInfo } from './types'

export function RechargePanel({ info, affiliate }: { info: TopupInfo; affiliate?: ReactNode }) {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    queries = useQueryClient(),
    formatQuota = useQuotaFormatter()
  const methods = availablePaymentMethods(info),
    [selected, setSelected] = useState(''),
    [input, setInput] = useState(''),
    [code, setCode] = useState('')
  const [confirm, setConfirm] = useState(false),
    [product, setProduct] = useState<CreemProduct | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const method = methods.find((item) => item.type === selected) || methods[0]
  const hasCreemProducts = !!(info.payment_compliance_confirmed && info.enable_creem_topup && info.creem_products?.length)
  const unavailableMessage = info.payment_compliance_confirmed
    ? 'No payment provider is configured.'
    : 'Payment, redemption, subscription, and invitation reward features are disabled. The administrator must confirm compliance terms before enabling them.'
  const minimum =
    Number(method?.min_topup) ||
    (method?.type === 'stripe' ? info.stripe_min_topup : method?.type === 'waffo_pancake' ? info.waffo_pancake_min_topup : info.min_topup) ||
    1
  const amount = input === '' ? minimum : Number(input)
  const presets = info.amount_options.length
    ? info.amount_options
    : generatePresetAmounts(minimum)
        .slice(0, 6)
        .map((item) => item.value)
  const quote = useQuery({
    queryKey: ['topup-quote', auth.bundle?.user.id, amount, method?.type],
    enabled: confirm && !product && !!method && Number.isInteger(amount) && amount >= minimum,
    queryFn: ({ signal }) => api<string>(topupEndpoint(method!.type, 'amount'), { method: 'POST', signal, body: { amount } }),
    staleTime: 0,
    gcTime: 0,
  })
  async function redeem(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/user/topup', { method: 'POST', body: { key: code.trim() } })
      setCode('')
      await queries.invalidateQueries({ queryKey: ['self'] })
      toast.success(t('Redemption successful'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function pay() {
    setBusy(true)
    setError('')
    try {
      if (product) await beginCheckout('/api/user/creem/pay', { product_id: product.productId, payment_method: 'creem' })
      else if (method)
        await beginCheckout(topupEndpoint(method.type, 'pay'), {
          amount,
          ...(method.type.startsWith('waffo:')
            ? { pay_method_index: Number(method.type.split(':')[1]) }
            : method.type === 'waffo_pancake'
              ? {}
              : { payment_method: method.type }),
        })
      setConfirm(false)
      setProduct(null)
      await queries.invalidateQueries({ queryKey: ['topup-orders'] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="finance-columns">
      <section className="console-panel recharge-main">
        <div className="finance-title">
          <CreditCard size={18} />
          <h2>{t('Online top-up')}</h2>
        </div>
        {!methods.length && !hasCreemProducts ? (
          <p>{t(unavailableMessage)}</p>
        ) : (
          <>
            {!!methods.length && (
              <>
                <label className="field">
                  <span>{t('Payment methods')}</span>
                  <select
                    disabled={busy}
                    value={method?.type || ''}
                    onChange={(event) => {
                      setSelected(event.target.value)
                      setInput('')
                    }}
                  >
                    {methods.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="amount-options">
                  {presets.map((value) => (
                    <button key={value} disabled={busy || value < minimum} data-active={amount === value} onClick={() => setInput(String(value))}>
                      {value}
                      {info.discount[value] && info.discount[value] !== 1 ? <small>× {info.discount[value]}</small> : null}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    setError('')
                    setConfirm(true)
                  }}
                >
                  <label className="field">
                    <span>{t('Topup Amount')}</span>
                    <input
                      type="number"
                      min={minimum}
                      step={1}
                      required
                      value={input === '' ? minimum : input}
                      onChange={(event) => setInput(event.target.value)}
                      disabled={busy}
                    />
                    <small className="small-note">
                      {t('Minimum')}: {minimum}
                    </small>
                  </label>
                  <Button type="submit" disabled={busy || !method || !Number.isInteger(amount) || amount < minimum}>
                    {t('Review payment')}
                  </Button>
                </form>
              </>
            )}
            {hasCreemProducts && (
              <div className="creem-products">
                {info.creem_products?.map((item) => (
                  <button
                    key={item.productId}
                    disabled={busy}
                    onClick={() => {
                      setProduct(item)
                      setError('')
                      setConfirm(true)
                    }}
                  >
                    <strong>{item.name}</strong>
                    <span>
                      {new Intl.NumberFormat(toIntlLocale(i18n.language), { style: 'currency', currency: item.currency }).format(item.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      <form className="console-panel" onSubmit={redeem}>
        <div className="finance-title">
          <Gift size={18} />
          <h2>{t('Redeem a code')}</h2>
        </div>
        <p className="small-note">{t('Enter your redemption code to add account credit.')}</p>
        <label className="field">
          <span>{t('Redemption code')}</span>
          <input required value={code} onChange={(event) => setCode(event.target.value)} disabled={!info.enable_redemption || busy} />
        </label>
        <Button type="submit" disabled={!info.enable_redemption || !code.trim() || busy}>
          {t(busy ? 'Loading' : 'Redeem')}
        </Button>
        {info.enable_redemption === false && (
          <p className="small-note" style={{ marginTop: 14 }}>
            {t('Redemption is not enabled.')}
          </p>
        )}
        {error && !confirm && (
          <p className="inline-error" role="alert">
            {t(error)}
          </p>
        )}
      </form>
      {affiliate}
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) {
            setConfirm(open)
            if (!open) setProduct(null)
          }
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t('Confirm Payment')}</DialogTitle>
            <DialogDescription>{t('Review your payment details')}</DialogDescription>
          </DialogHeader>
          <dl className="payment-summary">
            <div>
              <dt>{t('Payment methods')}</dt>
              <dd>{product ? 'Creem' : method?.name}</dd>
            </div>
            <div>
              <dt>{t('Topup Amount')}</dt>
              <dd>{product ? formatQuota(product.quota, { abbreviate: false }) : amount}</dd>
            </div>
            <div>
              <dt>{t('You Pay')}</dt>
              <dd>{product ? `${product.currency} ${product.price}` : quote.isFetching ? t('Loading') : quote.data || '—'}</dd>
            </div>
          </dl>
          {quote.error && !product && <ErrorState error={quote.error} />}
          <p className="small-note">{t('Your balance updates after the payment provider confirms the order.')}</p>
          {error && (
            <p className="inline-error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="security-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setConfirm(false)
                setProduct(null)
              }}
            >
              {t('Cancel')}
            </Button>
            <Button
              disabled={busy || (!product && (quote.isFetching || !quote.data || !Number.isFinite(Number(quote.data)) || Number(quote.data) <= 0))}
              onClick={pay}
            >
              {t(busy ? 'Loading' : 'Continue to payment')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
