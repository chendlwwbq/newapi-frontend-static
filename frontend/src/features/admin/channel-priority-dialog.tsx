'use client'

import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { AdminConfirm } from './shared'
import { channelPriorityUndo, type ChannelPriorityMove, type ChannelPriorityOrder } from './lib/channel-priority'
import type { PageResult } from '@/lib/api/types'
import type { Channel } from './types'

export function ChannelPriorityDialog({
  channels,
  ownerId,
  write,
  onClose,
}: {
  channels: Channel[]
  ownerId: number
  write: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation(),
    queries = useQueryClient(),
    locale = toIntlLocale(i18n.language)
  const [id, setId] = useState(channels[0]?.id || 0),
    [target, setTarget] = useState(0),
    [position, setPosition] = useState<ChannelPriorityMove['position']>('before')
  const [preview, setPreview] = useState<{ request: ChannelPriorityMove; result: ChannelPriorityOrder } | null>(null),
    [undo, setUndo] = useState<ReturnType<typeof channelPriorityUndo> | null>(null),
    [confirmUndo, setConfirmUndo] = useState(false)
  const query = useQuery({
    queryKey: ['channel-priority-order', ownerId],
    queryFn: ({ signal }) => api<ChannelPriorityOrder>('/api/channel/priority/order', { signal }),
  })
  const channelNames = useQuery({
    queryKey: ['channel-name-cache', ownerId],
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const names: Record<number, string> = {}
      let loaded = 0
      for (let page = 1; page <= 10000; page++) {
        const result = await api<PageResult<Pick<Channel, 'id' | 'name'>>>(`/api/channel/?p=${page}&page_size=100`, { signal })
        for (const channel of result.items) names[channel.id] = channel.name
        loaded += result.items.length
        if (loaded >= result.total) return names
        if (!result.items.length) throw new Error('Invalid server response')
      }
      throw new Error('Invalid server response')
    },
  })
  const mutation = useMutation({
    mutationFn: (body: ChannelPriorityMove | ReturnType<typeof channelPriorityUndo>) =>
      api<ChannelPriorityOrder>('/api/channel/priority/reorder', { method: 'POST', body }),
    onSuccess: (result, body) => {
      if ('preview' in body && body.preview) {
        setPreview({ request: body, result })
        return
      }
      setPreview(null)
      setConfirmUndo(false)
      setUndo('restore' in body ? null : channelPriorityUndo(result))
      queries.setQueryData(['channel-priority-order', ownerId], result)
      void queries.invalidateQueries({ queryKey: ['admin-channels'] })
    },
    onError: (_error, body) => {
      setPreview(null)
      setConfirmUndo(false)
      if ('restore' in body) setUndo(null)
      void query.refetch()
    },
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (query.data) mutation.mutate({ revision: query.data.revision, id, target_id: target, position, preview: true })
  }
  const names = new Map([
      ...channels.map((channel) => [channel.id, channel.name] as const),
      ...Object.entries(channelNames.data || {}).map(([id, name]) => [Number(id), name] as const),
    ]),
    items = [...(query.data?.items || [])].sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.id - b.id)
  const busy = mutation.isPending
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy) onClose()
        }}
      >
        <DialogContent className="admin-editor channel-priority-dialog">
          <DialogHeader>
            <DialogTitle>{t('Priority order')}</DialogTitle>
          </DialogHeader>
          <p className="small-note">{t('Higher priority channels are tried first. Channels at the same priority share traffic by weight.')}</p>
          {channelNames.error && <ErrorState error={channelNames.error} retry={() => channelNames.refetch()} />}
          {query.isPending ? (
            <LoadingState />
          ) : query.error ? (
            <ErrorState error={query.error} retry={() => query.refetch()} />
          ) : (
            <>
              <form onSubmit={submit}>
                <div className="admin-form-grid">
                  <label className="field">
                    <span>{t('Channel')}</span>
                    <select
                      value={id}
                      disabled={busy || !write}
                      onChange={(event) => {
                        setId(Number(event.target.value))
                        setPreview(null)
                      }}
                    >
                      <option value={0} disabled>
                        {t('Select')}
                      </option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          #{item.id} {names.get(item.id) || ''} · {formatNumber(item.priority ?? 0, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t('Target channel')}</span>
                    <select
                      required
                      value={target}
                      disabled={busy || !write}
                      onChange={(event) => {
                        setTarget(Number(event.target.value))
                        setPreview(null)
                      }}
                    >
                      <option value={0} disabled>
                        {t('Select')}
                      </option>
                      {items
                        .filter((item) => item.id !== id)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            #{item.id} {names.get(item.id) || ''} · {formatNumber(item.priority ?? 0, locale)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t('Position')}</span>
                    <select
                      value={position}
                      disabled={busy || !write}
                      onChange={(event) => {
                        setPosition(event.target.value as ChannelPriorityMove['position'])
                        setPreview(null)
                      }}
                    >
                      <option value="before">{t('Before')}</option>
                      <option value="after">{t('After')}</option>
                      <option value="same">{t('Same priority')}</option>
                    </select>
                  </label>
                </div>
                <div className="action-buttons">
                  <Button type="submit" variant="outline" disabled={busy || !write || !id || !target || id === target}>
                    {t('Preview')}
                  </Button>
                  {undo && (
                    <Button type="button" variant="outline" disabled={busy || !write} onClick={() => setConfirmUndo(true)}>
                      {t('Undo')}
                    </Button>
                  )}
                </div>
              </form>
              {preview && (
                <section>
                  <h3>{t('Review changes')}</h3>
                  {!preview.result.changes.length ? (
                    <p>{t('No changes made')}</p>
                  ) : (
                    <>
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {['Channel', 'Previous priority', 'Priority'].map((label) => (
                                <th key={label}>{t(label)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.result.changes.map((change) => (
                              <tr key={change.id}>
                                <td>
                                  #{change.id} {names.get(change.id) || ''}
                                </td>
                                <td>{formatNumber(change.previous ?? 0, locale)}</td>
                                <td>{formatNumber(change.priority ?? 0, locale)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Button disabled={busy} onClick={() => mutation.mutate({ ...preview.request, preview: false })}>
                        {t('Apply')}
                      </Button>
                    </>
                  )}
                </section>
              )}
              <details>
                <summary>{t('Current order')}</summary>
                <ol className="channel-priority-list">
                  {items.map((item) => (
                    <li key={item.id}>
                      <span>
                        #{item.id} {names.get(item.id) || ''}
                      </span>
                      <strong>{formatNumber(item.priority ?? 0, locale)}</strong>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
          {mutation.error && (
            <p role="alert" className="inline-error">
              {t(mutation.error.message)}
            </p>
          )}
        </DialogContent>
      </Dialog>
      {confirmUndo && undo && (
        <AdminConfirm
          title={t('Undo')}
          description={undo.restore.map((change) => `#${change.id}: ${change.previous ?? 0} → ${change.priority ?? 0}`).join('; ')}
          busy={busy}
          onClose={() => setConfirmUndo(false)}
          onConfirm={() => mutation.mutate(undo)}
        />
      )}
    </>
  )
}
