'use client'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { useCurrencyFormatter, useQuotaFormatter } from '@/lib/format'
import type { UserWalletData } from './types'
import { generateAffiliateLink } from './lib/affiliate'

export function AffiliatePanel({ user, enabled }: { user: UserWalletData; enabled: boolean }) {
  const { t } = useTranslation(),
    auth = useAuth(),
    queries = useQueryClient(),
    format = useQuotaFormatter(),
    currency = useCurrencyFormatter()
  const [origin, setOrigin] = useState(''),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const minTransfer = currency.formatter.getCurrencyDisplay().config.quotaPerUnit
  const affiliate = useQuery({ queryKey: ['affiliate', auth.bundle?.user.id], queryFn: () => api<string>('/api/user/aff') })
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])
  const link = affiliate.data && origin ? generateAffiliateLink(affiliate.data) : ''
  async function transfer() {
    setBusy(true)
    setError('')
    try {
      await api('/api/user/aff_transfer', { method: 'POST', body: { quota: user.aff_quota } })
      await queries.invalidateQueries({ queryKey: ['self'] })
      setConfirm(false)
      toast.success(t('Transfer successful'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <section className="console-panel">
        <h2>{t('Invite friends')}</h2>
        <p className="small-note">{t('Share your invitation link. Rewards follow the site settings.')}</p>
        {affiliate.error ? (
          <ErrorState error={affiliate.error} />
        ) : (
          <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <input
              type="text"
              readOnly
              value={link || '—'}
              aria-label={t('Invitation link')}
              onClick={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
            />
            {link && <CopyButton value={link} label={t('Copy invitation link')} />}
          </div>
        )}
        <div className="affiliate-stats">
          {[
            ['Invited users', user.aff_count],
            ['Available rewards', format(user.aff_quota)],
            ['Lifetime rewards', format(user.aff_history_quota)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{t(String(label))}</span>
              <strong className="tabular-nums font-mono">{value}</strong>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!enabled || user.aff_quota < minTransfer || busy}
            onClick={() => {
              setError('')
              setConfirm(true)
            }}
          >
            {t('Transfer rewards to balance')}
          </Button>
          <span className="small-note">{t('Minimum transfer quota is {{min}}', { min: currency.ready ? format(minTransfer) : '—' })}</span>
        </div>
      </section>
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open)
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t('Transfer rewards to balance')}</DialogTitle>
            <DialogDescription>{format(user.aff_quota)}</DialogDescription>
          </DialogHeader>
          <p className="small-note">{t('This transfers all available invitation rewards into your API account balance.')}</p>
          {error && (
            <p className="inline-error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="security-actions">
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>
              {t('Cancel')}
            </Button>
            <Button loading={busy} onClick={transfer}>
              {t('Confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
