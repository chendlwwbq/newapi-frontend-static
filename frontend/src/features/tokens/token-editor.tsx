'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUp, ArrowDown, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import type { Token } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ErrorState } from '@/components/shared/states'
import { newToken, quotaInput, tokenPayload, tokenGroupSelectable, type QuotaStatus } from './token-form'

export function TokenEditor({
  initial,
  status,
  requestedGroup,
  onCreated,
  onClose,
}: {
  initial?: Token
  status: QuotaStatus
  requestedGroup?: string
  onCreated?: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const auth = useAuth()
  const queries = useQueryClient()
  const currency = quotaInput(status)

  const [draft, setDraft] = useState(() => initial || newToken(status, requestedGroup))
  const [amount, setAmount] = useState(() => String(currency.toDisplay(initial?.remain_quota ?? 0)))

  const identity = [auth.bundle?.user.id, auth.bundle?.user.group, auth.bundle?.session.sid]

  const groups = useQuery({
    queryKey: ['groups', ...identity],
    queryFn: () => api<Record<string, { desc: string; ratio: number }>>('/api/user/self/groups'),
  })

  const auto = useQuery({
    queryKey: ['token-auto-groups', ...identity],
    queryFn: () => api<{ groups: string[]; max_count: number }>('/api/token/auto-groups'),
  })

  const models = useQuery({
    queryKey: ['user-models', ...identity],
    queryFn: () => api<string[]>('/api/user/models'),
  })

  const save = useMutation({
    mutationFn: (body: Partial<Token>) => api('/api/token/', { method: body.id ? 'PUT' : 'POST', body }),
    onSuccess: (_data, variables) => {
      void queries.invalidateQueries({ queryKey: ['tokens'] })
      toast.success(t('Saved'))
      if (!variables.id) onCreated?.()
      onClose()
    },
    onError: (error) => toast.error(t(error.message)),
  })

  function patch(next: Partial<Token>) {
    setDraft((previous) => ({ ...previous, ...next }))
  }

  const groupAvailable = tokenGroupSelectable(draft.group || '', groups.error ? undefined : groups.data, initial?.group)
  const groupMissing = !groups.error && !!groups.data && draft.group !== '' && !Object.hasOwn(groups.data, draft.group || '')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!groupAvailable) return

    try {
      save.mutate(
        tokenPayload({
          ...draft,
          remain_quota: draft.unlimited_quota ? (draft.remain_quota ?? 0) : currency.toQuota(Number(amount)),
        })
      )
    } catch (error) {
      toast.error(t((error as Error).message))
    }
  }

  const chosen = draft.auto_groups ?? []
  const available = auto.data?.groups ?? []

  function move(index: number, offset: number) {
    const next = [...chosen]
    ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
    patch({ auto_groups: next })
  }

  let expires = ''
  if (draft.expired_time && draft.expired_time !== -1) {
    const date = new Date(draft.expired_time * 1000)
    expires = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  return (
    <DialogContent className="token-editor">
      <DialogHeader>
        <DialogTitle>{t(initial ? 'Edit key' : 'New key')}</DialogTitle>
        <DialogDescription>{t('Manage keys for your applications and services.')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={submit}>
        <label className="field">
          <span>{t('Key name')}</span>
          <input autoFocus required maxLength={50} value={draft.name || ''} onChange={(e) => patch({ name: e.target.value })} />
        </label>

        <label className="field">
          <span>{t('Group')}</span>
          <select value={draft.group} onChange={(e) => patch({ group: e.target.value })}>
            {[...new Set([draft.group ?? 'default', ...Object.keys(groups.data || {})])].map((name) => (
              <option key={name} value={name}>
                {name.startsWith('xlsx-g-') && groups.data?.[name]?.desc ? (
                  groups.data[name].desc
                ) : (
                  <>
                    {name || t('Current group')}
                    {groups.data?.[name]?.desc ? ` · ${t(groups.data[name].desc)}` : ''}
                  </>
                )}
              </option>
            ))}
          </select>
        </label>

        {groups.error && <ErrorState error={groups.error} retry={() => groups.refetch()} />}
        {groupMissing && (
          <p role="alert" className="small-note">
            {t('Selected group is unavailable.')}
          </p>
        )}

        {draft.group === 'auto' && (
          <fieldset className="token-auto-groups">
            <legend>{t('Auto group order')}</legend>
            <p className="small-note">{t('Empty selection inherits the system order.')}</p>

            {auto.error ? (
              <ErrorState error={auto.error} retry={() => auto.refetch()} />
            ) : (
              <>
                <ol>
                  {chosen.map((name, index) => (
                    <li key={name}>
                      <span>
                        {index + 1}. {name}
                        {!available.includes(name) && <small> · {t('Unavailable')}</small>}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!index}
                        aria-label={`${t('Move up')} ${name}`}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === chosen.length - 1}
                        aria-label={`${t('Move down')} ${name}`}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`${t('Remove')} ${name}`}
                        onClick={() => patch({ auto_groups: chosen.filter((value) => value !== name) })}
                      >
                        <X size={13} />
                      </Button>
                    </li>
                  ))}
                </ol>

                <label className="field">
                  <span>
                    {t('Add group')} ({chosen.length}/{auto.data?.max_count ?? '—'})
                  </span>
                  <select
                    value=""
                    disabled={!auto.data || chosen.length >= (auto.data?.max_count ?? 0)}
                    onChange={(e) => {
                      if (e.target.value) patch({ auto_groups: [...chosen, e.target.value] })
                    }}
                  >
                    <option value="">{t('Select group')}</option>
                    {available
                      .filter((name) => !chosen.includes(name))
                      .map((name) => (
                        <option value={name} key={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}

            <label className="checkbox-label">
              <input type="checkbox" checked={!!draft.cross_group_retry} onChange={(e) => patch({ cross_group_retry: e.target.checked })} />
              {t('Cross-group retry')}
            </label>
          </fieldset>
        )}

        <label className="checkbox-label">
          <input type="checkbox" checked={!!draft.unlimited_quota} onChange={(e) => patch({ unlimited_quota: e.target.checked })} />
          {t('Do not limit spending on this key (account balance and subscription rules still apply)')}
        </label>

        {!draft.unlimited_quota && (
          <label className="field">
            <span>
              {t('Quota')} ({currency.label})
            </span>
            <input type="number" required min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        )}

        <label className="field">
          <span>{t('Expiry')}</span>
          <input
            type="datetime-local"
            value={expires}
            onChange={(e) =>
              patch({
                expired_time: e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : -1,
              })
            }
          />
          <small className="small-note">{t('Empty means never expires')}</small>
        </label>

        <details className="token-advanced" open={!!initial}>
          <summary>{t('Advanced settings')}</summary>

          <label className="checkbox-label">
            <input type="checkbox" checked={!!draft.model_limits_enabled} onChange={(e) => patch({ model_limits_enabled: e.target.checked })} />
            {t('Model restrictions')}
          </label>

          {draft.model_limits_enabled && (
            <label className="field">
              <span>{t('Models')}</span>
              <input list="token-model-options" value={draft.model_limits || ''} onChange={(e) => patch({ model_limits: e.target.value })} />
              <datalist id="token-model-options">
                {models.data?.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <small>{t('Separate model IDs with commas.')}</small>
            </label>
          )}

          <label className="field">
            <span>{t('IP restrictions')}</span>
            <textarea value={draft.allow_ips || ''} onChange={(e) => patch({ allow_ips: e.target.value })} rows={3} />
            <small>{t('One IP or CIDR per line. Empty allows all IPs.')}</small>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.allow_user_quota_query !== false}
              onChange={(e) => patch({ allow_user_quota_query: e.target.checked })}
            />
            {t('Allow user quota queries')}
          </label>
        </details>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending || !groupAvailable || (draft.group === 'auto' && !auto.data)}>
            {t(save.isPending ? 'Loading' : 'Save')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
