'use client'
import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { useAuthStatus } from '@/features/auth/use-auth-status'

export interface PasskeyDomainChange {
  rp_id: string
  legacy_rp_ids: string
  origins: string
  previous_rp_id: string
  effective_rp_id: string
  removed_rp_ids: string[]
  affected_credentials: number
  unknown_credentials: number
  confirmation_required: boolean
  removal_confirmation: string
}
type DomainInput = Pick<PasskeyDomainChange, 'rp_id' | 'legacy_rp_ids' | 'origins'>
const domainFields = [
  ['rp_id', 'RP ID'],
  ['legacy_rp_ids', 'Legacy RP IDs'],
  ['origins', 'Allowed Origins'],
] as const

export function PasskeyDomains({ initial }: { initial: Record<string, string> }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    status = useAuthStatus()
  const [baseline, setBaseline] = useState<DomainInput>({
    rp_id: initial['passkey.rp_id'] || '',
    legacy_rp_ids: initial['passkey.legacy_rp_ids'] || '',
    origins: initial['passkey.origins'] || '',
  })
  const [draft, setDraft] = useState(baseline),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState<{ input: DomainInput; change: PasskeyDomainChange } | null>(null)
  const [confirmed, setConfirmed] = useState(false),
    [notice, setNotice] = useState('')
  const dirty = domainFields.some(([key]) => draft[key] !== baseline[key])
  async function preview(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    setConfirmed(false)
    const input = {
      ...draft,
      legacy_rp_ids: draft.legacy_rp_ids
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .join(','),
      origins: draft.origins
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .join(','),
    }
    try {
      setReview({
        input,
        change: await api<PasskeyDomainChange>('/api/option/passkey/domains', { method: 'PUT', body: { ...input, preview: true } }),
      })
    } catch (error) {
      toast.error(t((error as Error).message))
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    if (!review) return
    setBusy(true)
    try {
      const result = await api<PasskeyDomainChange>('/api/option/passkey/domains', {
        method: 'PUT',
        body: { ...review.input, preview: false, removal_confirmation: review.change.removal_confirmation },
      })
      const saved = { rp_id: result.rp_id, legacy_rp_ids: result.legacy_rp_ids, origins: result.origins }
      setBaseline(saved)
      setDraft(saved)
      setReview(null)
      setConfirmed(false)
      setNotice('')
      toast.success(t('Saved'))
      for (const key of ['system-options', 'status']) void queries.invalidateQueries({ queryKey: [key] })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PASSKEY_RP_ID_REMOVAL_CONFIRMATION_REQUIRED' && error.data) {
        setReview({ input: review.input, change: error.data as PasskeyDomainChange })
        setConfirmed(false)
        setNotice('The domain impact changed. Review the updated result before saving again.')
      } else toast.error(t((error as Error).message))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="passkey-domains">
      <h2>{t('Passkey domains')}</h2>
      <p className="small-note">
        {t('Domain changes are previewed by the server. Previous RP IDs are retained automatically when the primary domain changes.')}
      </p>
      <p className="small-note">
        {t('Effective RP ID')}: <code>{String(status.data?.passkey_rp_id || '—')}</code>
      </p>
      <form onSubmit={preview}>
        <fieldset className="admin-pricing-fields settings-fields" disabled={busy || !!review}>
          {domainFields.map(([key, label]) => (
            <label className="field" key={key} htmlFor={`domain-${key}`}>
              {t(label)}
              {key === 'rp_id' ? (
                <input
                  id={`domain-${key}`}
                  value={draft[key]}
                  placeholder="example.com"
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              ) : (
                <textarea
                  id={`domain-${key}`}
                  rows={4}
                  value={draft[key].split(',').join('\n')}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              )}
            </label>
          ))}
          <div className="settings-save">
            <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDraft(baseline)}>
              {t('Reset')}
            </Button>
            <Button type="submit" disabled={!dirty}>
              {t('Preview domain changes')}
            </Button>
          </div>
        </fieldset>
      </form>
      {review && (
        <div className="domain-review" aria-live="polite">
          <h3>{t('Review domain changes')}</h3>
          {notice && <p role="alert">{t(notice)}</p>}
          <dl>
            {[
              ['Previous RP ID', review.change.previous_rp_id],
              ['Effective RP ID', review.change.effective_rp_id],
              ['Legacy RP IDs', review.change.legacy_rp_ids || '—'],
              ['Allowed Origins', review.change.origins || '—'],
              ['Removed RP IDs', review.change.removed_rp_ids.join(', ') || '—'],
              ['Affected Passkeys', review.change.affected_credentials],
              ['Passkeys with unknown RP ID', review.change.unknown_credentials],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{t(String(label))}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {review.change.confirmation_required && (
            <label className="checkbox-label">
              <input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />
              {t('I understand that removing these domains can make the affected Passkeys unusable.')}
            </label>
          )}
          <div className="settings-save">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setReview(null)
                setNotice('')
                setConfirmed(false)
              }}
            >
              {t('Back')}
            </Button>
            <Button disabled={busy || (review.change.confirmation_required && !confirmed)} onClick={save}>
              {t(busy ? 'Loading' : 'Save')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
