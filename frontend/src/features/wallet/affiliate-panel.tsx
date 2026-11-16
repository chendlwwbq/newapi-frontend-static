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
import { useQuotaFormatter } from '@/lib/format'
import type { UserWalletData } from './types'
import { generateAffiliateLink } from './lib/affiliate'

export function AffiliatePanel({ user, enabled }: { user: UserWalletData; enabled: boolean }) {
  const { t } = useTranslation(),
    auth = useAuth(),
    queries = useQueryClient(),
    format = useQuotaFormatter()
  const [origin, setOrigin] = useState(''),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
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
          <div className="recovery-secret">
            <code>{link || '—'}</code>
            {link && <CopyButton value={link} />}
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
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <Button
          disabled={!enabled || !user.aff_quota || busy}
          onClick={() => {
            setError('')
            setConfirm(true)
          }}
        >
          {t('Transfer rewards to balance')}
        </Button>
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
            <Button disabled={busy} onClick={transfer}>
              {t(busy ? 'Loading' : 'Confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
