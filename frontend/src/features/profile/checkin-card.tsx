'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { Turnstile } from '@/features/auth/turnstile'
import { checkinMonth, monthCells } from './preferences'

type CheckinStatus = {
  enabled: boolean
  stats: {
    checked_in_today: boolean
    total_checkins: number
    total_quota: number
    checkin_count: number
    records: { checkin_date: string; quota_awarded: number }[]
  }
}
export function CheckinCard({ siteKey }: { siteKey?: string }) {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    queries = useQueryClient(),
    money = useQuotaFormatter()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    [token, setToken] = useState(''),
    [widget, setWidget] = useState(0)
  const key = checkinMonth(month),
    today = checkinMonth(new Date()),
    locale = toIntlLocale(i18n.language)
  const query = useQuery({ queryKey: ['checkin', auth.bundle?.user.id, key], queryFn: () => api<CheckinStatus>(`/api/user/checkin?month=${key}`) })
  const mutation = useMutation({
    mutationFn: () =>
      api<{ quota_awarded: number }>(`/api/user/checkin${token ? '?turnstile=' + encodeURIComponent(token) : ''}`, { method: 'POST' }),
    onSuccess: async (result) => {
      toast.success(`${t('Check-in successful')} · ${money(result.quota_awarded)}`)
      await Promise.all([queries.invalidateQueries({ queryKey: ['checkin'] }), queries.invalidateQueries({ queryKey: ['self'] })])
    },
    onError: (error) => toast.error(t(error.message)),
    onSettled: () => {
      setToken('')
      setWidget((value) => value + 1)
    },
  })
  const records = new Map(query.data?.stats.records.map((record) => [record.checkin_date, record.quota_awarded]))
  return (
    <section className="console-panel profile-checkin">
      <div className="profile-section-heading">
        <h2>{t('Daily check-in')}</h2>
        <div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('Previous month')}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft size={15} />
          </Button>
          <span>{month.toLocaleDateString(locale, { year: 'numeric', month: 'long' })}</span>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('Next month')}
            disabled={key >= today}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : !query.data.enabled ? (
        <p className="small-note">{t('Check-in feature is not enabled')}</p>
      ) : (
        <>
          <div className="checkin-calendar">
            {Array.from({ length: 7 }, (_, day) => (
              <small key={day}>{new Date(2026, 9, 25 + day).toLocaleDateString(locale, { weekday: 'short' })}</small>
            ))}
            {monthCells(month).map((date, index) =>
              date ? (
                <div key={date} data-checked={records.has(date)} title={records.has(date) ? `${date} · ${money(records.get(date)!)}` : date}>
                  <span>{Number(date.slice(-2))}</span>
                  {records.has(date) && <Check size={11} />}
                </div>
              ) : (
                <div key={`empty-${index}`} aria-hidden="true" />
              )
            )}
          </div>
          <div className="settings-row">
            <span>{t('Total check-ins')}</span>
            <strong className="tabular-nums font-mono">{query.data.stats.total_checkins}</strong>
          </div>
          <div className="settings-row">
            <span>{t('Total rewards')}</span>
            <strong className="tabular-nums font-mono">{money(query.data.stats.total_quota)}</strong>
          </div>
          {siteKey && !query.data.stats.checked_in_today && <Turnstile key={widget} siteKey={siteKey} onToken={setToken} />}
          <Button
            className="w-full transition-all active:scale-[0.98]"
            disabled={mutation.isPending || query.data.stats.checked_in_today || (!!siteKey && !token)}
            onClick={() => mutation.mutate()}
          >
            {t(query.data.stats.checked_in_today ? 'Already checked in today' : 'Check in')}
          </Button>
        </>
      )}
    </section>
  )
}
