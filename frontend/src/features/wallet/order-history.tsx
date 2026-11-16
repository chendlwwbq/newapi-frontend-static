'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { useCurrencyFormatter, formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm } from '@/features/admin/shared'
import type { BillingHistoryResponse, TopupRecord } from './types'

export function OrderHistory() {
  const { t } = useTranslation(),
    auth = useAuth(),
    queries = useQueryClient(),
    currency = useCurrencyFormatter()
  const userId = auth.bundle!.user.id,
    admin = auth.bundle!.user.role >= 10
  const [scope, setScope] = useState('self'),
    [page, setPage] = useState(1),
    [size, setSize] = useState(20),
    [search, setSearch] = useState(''),
    [keyword, setKeyword] = useState(''),
    [completing, setCompleting] = useState<TopupRecord | null>(null)
  const all = admin && scope === 'all'
  const params = new URLSearchParams({ p: String(page), page_size: String(size), keyword })
  const orders = useQuery({
    queryKey: ['topup-orders', userId, all, page, size, keyword],
    queryFn: ({ signal }) => api<BillingHistoryResponse>(`/api/user/topup${all ? '' : '/self'}?${params}`, { signal }),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.items.some((item) => item.status === 'pending') ? 5000 : false),
  })
  const complete = useMutation({
    mutationFn: (trade_no: string) => api('/api/user/topup/complete', { method: 'POST', body: { trade_no } }),
    onSuccess: async () => {
      setCompleting(null)
      await Promise.all([queries.invalidateQueries({ queryKey: ['topup-orders'] }), queries.invalidateQueries({ queryKey: ['self'] })])
      toast.success(t('Order completed successfully'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setKeyword(search.trim())
  }
  function date(seconds?: number) {
    return seconds ? new Date(seconds * 1000).toLocaleString(currency.locale) : '—'
  }
  function amount(order: TopupRecord) {
    if (!currency.ready) return '—'
    const options = { locale: currency.locale, abbreviate: false }
    return order.payment_provider === 'creem'
      ? currency.formatter.formatQuotaWithCurrency(order.amount, options)
      : currency.formatter.formatCurrencyFromUSD(order.amount, options)
  }
  const total = orders.data?.total ?? 0,
    pages = Math.max(1, Math.ceil(total / size))
  return (
    <section className="console-panel wallet-order-history">
      <form className="finance-search" onSubmit={submit}>
        <label className="field">
          <span>{t('Search orders')}</span>
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Order number')}
          />
        </label>
        {admin && (
          <label className="field">
            <span>{t('Scope')}</span>
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value)
                setPage(1)
              }}
            >
              <option value="self">{t('My records')}</option>
              <option value="all">{t('All records')}</option>
            </select>
          </label>
        )}
        <Button type="submit" variant="outline">
          {t('Search')}
        </Button>
      </form>
      {orders.isPending ? (
        <LoadingState />
      ) : orders.error ? (
        <ErrorState error={orders.error} retry={() => orders.refetch()} />
      ) : !orders.data.items.length ? (
        <EmptyState />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  'Order number',
                  ...(all ? ['User ID'] : []),
                  'Time',
                  'Topup Amount',
                  'Payment amount',
                  'Payment methods',
                  'Status',
                  'Finished',
                  ...(all ? ['Actions'] : []),
                ].map((label) => (
                  <th key={label} className={['Topup Amount', 'Payment amount'].includes(label) ? 'text-right' : undefined}>
                    {t(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.data.items.map((order) => (
                <tr key={order.id}>
                  <td>
                    <div className="task-id">
                      <code>{order.trade_no}</code>
                      <CopyButton value={order.trade_no} />
                    </div>
                  </td>
                  {all && <td>{order.user_id}</td>}
                  <td className="small-note tabular-nums font-mono">{date(order.create_time)}</td>
                  <td className="text-right tabular-nums font-mono">{amount(order)}</td>
                  <td className="text-right tabular-nums font-mono">
                    {order.payment_provider === 'creem'
                      ? `${formatNumber(order.money, currency.locale)} USD`
                      : currency.ready
                        ? `${currency.formatter.formatCurrencyFromUSD(order.money, { locale: currency.locale, abbreviate: false })} ${currency.formatter.getCurrencyLabel()}`
                        : formatNumber(order.money, currency.locale)}
                  </td>
                  <td>
                    {t(
                      (
                        {
                          alipay: 'Alipay',
                          wxpay: 'WeChat Pay',
                          stripe: 'Stripe',
                          creem: 'Creem',
                          waffo: 'Waffo',
                          waffo_pancake: 'Waffo Pancake',
                        } as Record<string, string>
                      )[order.payment_method] || order.payment_method
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        order.status === 'success'
                          ? 'success'
                          : order.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                      }`}
                      data-enabled={order.status === 'success'}
                    >
                      {t(({ success: 'Success', pending: 'Pending', expired: 'Expired' } as Record<string, string>)[order.status] || order.status)}
                    </span>
                  </td>
                  <td className="small-note tabular-nums font-mono">{date(order.complete_time)}</td>
                  {all && (
                    <td>
                      {order.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => setCompleting(order)}>
                          {t('Complete Order')}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="finance-pagination">
        <label>
          {t('Rows per page')}{' '}
          <select
            className="plain-select"
            value={size}
            onChange={(event) => {
              setSize(Number(event.target.value))
              setPage(1)
            }}
          >
            {[20, 50, 100].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <span>
          {t('Total')}: {total}
        </span>
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
          {t('Previous')}
        </Button>
        <span>
          {page}/{pages}
        </span>
        <Button variant="outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
          {t('Next')}
        </Button>
      </div>
      {completing && (
        <AdminConfirm
          title={t('Complete Order')}
          description={`${completing.trade_no} · ${t('Manually credit this order only after verifying payment. This changes the account balance.')}`}
          busy={complete.isPending}
          onClose={() => setCompleting(null)}
          onConfirm={() => complete.mutate(completing.trade_no)}
        />
      )}
    </section>
  )
}
