'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AdminConfirm } from './shared'
import { ChannelTagEditor } from './channel-tag-editor'
import type { Channel } from './types'

export type ChannelBatchOperation = { kind: 'tag'; ids: number[] } | { kind: 'copy'; channel: Channel }
export function ChannelBatchDialog({ operation, onClose }: { operation: ChannelBatchOperation; onClose: () => void }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [value, setValue] = useState(operation.kind === 'copy' ? '_copy' : ''),
    [reset, setReset] = useState(true),
    copy = operation.kind === 'copy'
  const save = useMutation({
    mutationFn: () =>
      copy
        ? api(`/api/channel/copy/${operation.channel.id}?${new URLSearchParams({ suffix: value, reset_balance: String(reset) })}`, { method: 'POST' })
        : api('/api/channel/batch/tag', { method: 'POST', body: { ids: operation.ids, tag: value.trim() || null } }),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['admin-channels'] })
      toast.success(t('Saved'))
      onClose()
    },
  })
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(copy ? 'Copy channel' : 'Set tag')}</DialogTitle>
        </DialogHeader>
        <p>{copy ? operation.channel.name : `${t('Selected')}: ${operation.ids.length}`}</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>{t(copy ? 'Name suffix' : 'Tag')}</span>
            <input value={value} onChange={(event) => setValue(event.target.value)} />
          </label>
          {copy ? (
            <label className="checkbox-label">
              <input type="checkbox" checked={reset} onChange={(event) => setReset(event.target.checked)} />
              {t('Reset balance and usage')}
            </label>
          ) : (
            <p className="small-note">{t('Leave blank to remove the tag.')}</p>
          )}
          {save.error && (
            <p role="alert" className="inline-error">
              {t(save.error.message)}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t('Confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ChannelTagManager({
  tag,
  write,
  operate,
  sensitive,
  onClose,
}: {
  tag: string
  write: boolean
  operate: boolean
  sensitive: boolean
  onClose: () => void
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [edit, setEdit] = useState(false),
    [pending, setPending] = useState<'enabled' | 'disabled' | null>(null)
  const save = useMutation({
    mutationFn: (status: string) => api(`/api/channel/tag/${status}`, { method: 'POST', body: { tag } }),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['admin-channels'] })
      toast.success(t('Saved'))
      setPending(null)
      onClose()
    },
    onError: (error) => toast.error(t(error.message)),
  })
  if (edit) return <ChannelTagEditor tag={tag} sensitive={sensitive} onClose={onClose} />
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !save.isPending) onClose()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('Manage tag')} · {tag}
            </DialogTitle>
          </DialogHeader>
          <p>{t('Actions apply to every channel with this tag.')}</p>
          <div className="admin-action-list">
            {write && (
              <Button variant="outline" onClick={() => setEdit(true)}>
                {t('Batch Edit by Tag')}
              </Button>
            )}
            {operate && (
              <>
                <Button variant="outline" onClick={() => setPending('enabled')}>
                  {t('Enable All')}
                </Button>
                <Button variant="outline" onClick={() => setPending('disabled')}>
                  {t('Disable All')}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {pending && (
        <AdminConfirm
          title={t(pending === 'enabled' ? 'Enable All' : 'Disable All')}
          description={tag}
          busy={save.isPending}
          onClose={() => setPending(null)}
          onConfirm={() => save.mutate(pending)}
        />
      )}
    </>
  )
}
