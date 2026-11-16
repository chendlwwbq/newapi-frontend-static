'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm } from './shared'
import {
  codexWindows,
  codexUsedPercent,
  codexResetAvailable,
  codexCreditTimestamp,
  type CodexUsage,
  type CodexResetCredits,
  type CodexWindow,
  type CodexRateLimit,
} from './lib/codex-usage'
import type { Channel } from './types'

function CodexLimit({ label, rate, plan }: { label: string; rate?: CodexRateLimit; plan?: string }) {
  const { t, i18n } = useTranslation(),
    locale = toIntlLocale(i18n.language)
  const windows = codexWindows({ plan_type: plan, rate_limit: rate })
  const rows: Array<{ label: string; window: CodexWindow | null }> = [
    { label: '5-hour limit', window: windows.fiveHour },
    { label: 'Weekly limit', window: windows.weekly },
  ]
  let status = 'Unavailable'
  if (rate?.limit_reached === true || rate?.allowed === false) status = 'Limit reached'
  else if (rate?.allowed === true) status = 'Available'
  return (
    <section className="codex-limit">
      <h3>
        {label}
        <span className="status-badge">{t(status)}</span>
      </h3>
      <div className="codex-windows">
        {rows.map((row) => {
          const used = codexUsedPercent(row.window),
            reset = row.window?.reset_at,
            after = row.window?.reset_after_seconds
          return (
            <div key={row.label}>
              <strong>{t(row.label)}</strong>
              <p>{used === undefined ? t('Unavailable') : `${formatNumber(used, locale)}% ${t('Used')}`}</p>
              {used !== undefined && <progress max={100} value={used} aria-label={t(row.label)} />}
              <small>
                {t('Resets at')}: {typeof reset === 'number' && reset > 0 ? new Date(reset * 1000).toLocaleString(locale) : t('Unavailable')}
              </small>
              {typeof after === 'number' && after >= 0 && (
                <small>
                  {t('Reset after seconds')}: {formatNumber(after, locale)}
                </small>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function CodexChannelDialog({
  channel,
  ownerId,
  operate,
  sensitive,
  onClose,
}: {
  channel: Channel
  ownerId: number
  operate: boolean
  sensitive: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation(),
    locale = toIntlLocale(i18n.language),
    queries = useQueryClient()
  const [showCredits, setShowCredits] = useState(false),
    [resetConfirm, setResetConfirm] = useState(false)
  const prefix = `/api/channel/${channel.id}/codex`,
    key = ['channel-codex', ownerId, channel.id]
  const usage = useQuery({
    queryKey: [...key, 'usage'],
    queryFn: ({ signal }) => api<CodexUsage>(`${prefix}/usage`, { signal }),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const credits = useQuery({
    queryKey: [...key, 'credits'],
    queryFn: ({ signal }) => api<CodexResetCredits>(`${prefix}/usage/reset-credits`, { signal }),
    enabled: showCredits,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const refresh = useMutation({
    gcTime: 0,
    mutationFn: () =>
      api<{ expires_at?: string; last_refresh?: string; account_id?: string; email?: string }>(`${prefix}/refresh`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success(t('Refreshed'))
      void queries.invalidateQueries({ queryKey: key })
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const reset = useMutation({
    gcTime: 0,
    mutationFn: () => api<{ windows_reset?: string[]; code?: string }>(`${prefix}/usage/reset`, { method: 'POST', body: {} }),
    onSuccess: () => {
      setResetConfirm(false)
      toast.success(t('Usage reset successfully'))
      void queries.invalidateQueries({ queryKey: key })
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const count = codexResetAvailable(credits.data, usage.data),
    canReset = operate && typeof count === 'number' && count > 0 && !credits.isError && !usage.isError && !reset.isPending && !refresh.isPending
  const details = [...(credits.data?.credits || [])].sort((a, b) => Number(b.status === 'available') - Number(a.status === 'available'))
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !reset.isPending && !refresh.isPending) onClose()
      }}
    >
      <DialogContent className="admin-editor codex-channel-dialog">
        <DialogHeader>
          <DialogTitle>
            {t('Codex Usage')} · {channel.name}
          </DialogTitle>
          <DialogDescription>{t('Usage and reset credits come from the channel account.')}</DialogDescription>
        </DialogHeader>
        <div className="action-buttons">
          <Button
            variant="outline"
            disabled={usage.isFetching || credits.isFetching}
            onClick={() => {
              void usage.refetch()
              if (showCredits) void credits.refetch()
            }}
          >
            {t('Refresh')}
          </Button>
          {sensitive && (
            <Button variant="outline" disabled={refresh.isPending || reset.isPending} onClick={() => refresh.mutate()}>
              {t('Refresh credential')}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowCredits((value) => !value)}>
            {t('Reset credit details')}
          </Button>
        </div>
        {usage.isPending && <LoadingState />}
        {usage.error && <ErrorState error={usage.error} retry={() => usage.refetch()} />}
        {usage.data && (
          <>
            <p>
              {t('Account type')}: {usage.data.plan_type || usage.data.rate_limit?.plan_type || t('Unknown')}
              {usage.data.email && ` · ${usage.data.email}`}
            </p>
            <CodexLimit label={t('Usage')} rate={usage.data.rate_limit} plan={usage.data.plan_type} />
            {usage.data.additional_rate_limits?.map((limit, index) => (
              <CodexLimit
                key={`${limit.limit_name || limit.metered_feature}-${index}`}
                label={limit.limit_name || limit.metered_feature || t('Additional limit')}
                plan={limit.plan_type || usage.data?.plan_type}
                rate={limit.rate_limit || { primary_window: limit.primary_window, secondary_window: limit.secondary_window }}
              />
            ))}
            {(usage.data.credits?.overage_limit_reached || usage.data.spend_control?.reached) && (
              <p className="inline-error">{t('Spending limit reached')}</p>
            )}
          </>
        )}
        <p>
          {t('Available reset credits')}: {count === undefined ? t('Unavailable') : formatNumber(count, locale)}
        </p>
        {operate && (
          <Button variant="outline" disabled={!canReset} onClick={() => setResetConfirm(true)}>
            {t('Apply reset credit')}
          </Button>
        )}
        {showCredits && (
          <section>
            <h3>{t('Reset credit details')}</h3>
            {credits.isPending && <LoadingState />}
            {credits.error && <ErrorState error={credits.error} retry={() => credits.refetch()} />}
            {credits.data && (
              <>
                <p>
                  {t('Total earned')}:{' '}
                  {credits.data.total_earned_count === undefined ? t('Unavailable') : formatNumber(credits.data.total_earned_count, locale)}
                </p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {['Name', 'Status', 'Type', 'Granted at', 'Expires at', 'Redeemed at'].map((label) => (
                          <th key={label}>{t(label)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((credit, index) => (
                        <tr key={credit.id || index}>
                          <td>
                            {credit.title || credit.id || '—'}
                            {credit.description && <small>{credit.description}</small>}
                          </td>
                          <td>
                            {t(
                              ({ available: 'Available', redeemed: 'Redeemed', expired: 'Expired' } as Record<string, string>)[credit.status || ''] ||
                                'Unknown'
                            )}
                          </td>
                          <td>{credit.reset_type || '—'}</td>
                          {[credit.granted_at, credit.expires_at, credit.redeemed_at].map((value, column) => {
                            const timestamp = codexCreditTimestamp(value)
                            return <td key={column}>{timestamp ? new Date(timestamp).toLocaleString(locale) : '—'}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!details.length && <p>{t('No data yet')}</p>}
              </>
            )}
          </section>
        )}
        {refresh.data && (
          <p className="small-note">
            {t('Last refresh')}: {refresh.data.last_refresh || '—'} · {t('Expires at')}: {refresh.data.expires_at || '—'}
          </p>
        )}
        {usage.data && (
          <details>
            <summary>{t('Raw response')}</summary>
            <div className="code-preview">
              <CopyButton value={JSON.stringify(usage.data, null, 2)} />
              <pre>{JSON.stringify(usage.data, null, 2)}</pre>
            </div>
          </details>
        )}
        {resetConfirm && (
          <AdminConfirm
            title={t('Apply reset credit')}
            description={t('Used reset credits cannot be restored. This consumes one credit from the channel account.')}
            busy={reset.isPending}
            onClose={() => setResetConfirm(false)}
            onConfirm={() => {
              if (canReset) reset.mutate()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
