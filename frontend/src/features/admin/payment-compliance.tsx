'use client'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

// The native v1 notice and explicit acknowledgement, shared in meaning with the upstream settings page.
const statements = [
  'You have legally obtained authorization for the connected model APIs, accounts, keys, and quotas.',
  'You commit to using upstream APIs, accounts, keys, quotas, and service capabilities only within the scope of lawful authorization obtained from upstream service providers, model service providers, or relevant rights holders, and will not conduct unauthorized resale, trafficking, distribution, or other non-compliant commercialization.',
  'If you provide generative AI services to the public in mainland China, you will fulfill legal obligations including filing, security assessment, content safety, complaint handling, generated content labeling, log retention, and personal information protection.',
  'You commit not to use this system to implement, assist with, or indirectly implement acts that violate applicable laws and regulations, regulatory requirements, platform rules, public interests, or the lawful rights and interests of third parties.',
  'You understand and independently bear legal responsibility arising from deployment, operation, and charging behavior.',
  'You understand this compliance reminder is only for risk notice and does not constitute legal advice, a compliance review conclusion, or a guarantee of the legality of your use of this system; you should consult professional legal or compliance advisors based on your actual business scenario.',
]
const acknowledgement =
  'I have read and understood the above compliance reminder, acknowledge the related legal risks, and confirm that I bear legal responsibility arising from deployment, operation, and charging behavior.'

export function paymentComplianceConfirmed(values: Record<string, string>) {
  return values['payment_setting.compliance_confirmed'] === 'true' && values['payment_setting.compliance_terms_version'] === 'v1'
}

export function PaymentCompliance({ values }: { values: Record<string, string> }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [open, setOpen] = useState(false),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false)
  const confirmed = paymentComplianceConfirmed(values),
    required = t(acknowledgement)
  async function confirm() {
    if (text !== required) return
    setBusy(true)
    try {
      await api('/api/option/payment_compliance', { method: 'POST', body: { confirmed: true } })
      await queries.invalidateQueries({ queryKey: ['system-options'] })
      setOpen(false)
      setText('')
      toast.success(t('Saved'))
    } catch (error) {
      toast.error(t((error as Error).message))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="settings-compliance">
      <strong>
        {t('Confirm compliance terms')}: {t(confirmed ? 'Confirmed' : 'Pending')}
      </strong>
      {!confirmed && (
        <>
          <p className="small-note">
            {t(
              'Payment, redemption codes, subscription plans, and invitation rewards are locked until the root administrator confirms the compliance terms.'
            )}
          </p>
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            {t('Confirm compliance')}
          </Button>
        </>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) {
            setOpen(next)
            if (!next) setText('')
          }
        }}
      >
        <DialogContent className="settings-compliance-dialog" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t('Confirm compliance terms')}</DialogTitle>
            <DialogDescription>{t('Review the native payment notice and type the acknowledgement below.')}</DialogDescription>
          </DialogHeader>
          <ol>
            {statements.map((statement) => (
              <li key={statement}>{t(statement)}</li>
            ))}
          </ol>
          <label htmlFor="payment-acknowledgement">{required}</label>
          <Textarea
            id="payment-acknowledgement"
            rows={4}
            disabled={busy}
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
          />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="button" disabled={busy || text !== required} onClick={confirm}>
              {t(busy ? 'Loading' : 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
