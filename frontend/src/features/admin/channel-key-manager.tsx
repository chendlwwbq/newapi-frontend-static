'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorState, LoadingState, EmptyState } from '@/components/shared/states'
import { toIntlLocale } from '@/i18n/languages'
import { AdminConfirm } from './shared'
import { channelKeyRequest, type ChannelKeyPage, type ChannelKeyAction } from './lib/channel-operations'
import type { Channel } from './types'

const keyStatusLabels: Record<number, string> = { 1: 'Enabled', 2: 'Disabled', 3: 'Auto disabled' }
const actionLabels: Record<ChannelKeyAction, string> = {
  enable_key: 'Enable key',
  disable_key: 'Disable key',
  delete_key: 'Delete key',
  enable_all_keys: 'Enable all keys',
  disable_all_keys: 'Disable all keys',
  delete_disabled_keys: 'Delete Auto-Disabled',
}
export function ChannelKeyManager({
  channel,
  ownerId,
  sensitive,
  onClose,
}: {
  channel: Channel
  ownerId: number
  sensitive: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation(),
    queries = useQueryClient()
  const [page, setPage] = useState(1),
    [size, setSize] = useState(20),
    [status, setStatus] = useState(''),
    [pending, setPending] = useState<{ action: ChannelKeyAction; index?: number } | null>(null)
  const query = useQuery({
    queryKey: ['channel-key-status', ownerId, channel.id, page, size, status],
    gcTime: 0,
    queryFn: ({ signal }) =>
      api<ChannelKeyPage>('/api/channel/multi_key/manage', {
        method: 'POST',
        signal,
        body: { channel_id: channel.id, action: 'get_key_status', page, page_size: size, ...(status ? { status: Number(status) } : {}) },
      }),
  })
  const mutation = useMutation({
    mutationFn: ({ action, index }: { action: ChannelKeyAction; index?: number }) =>
      api('/api/channel/multi_key/manage', { method: 'POST', body: channelKeyRequest(channel.id, action, index) }),
    onSuccess: async () => {
      setPending(null)
      await Promise.all([
        queries.invalidateQueries({ queryKey: ['channel-key-status', ownerId, channel.id] }),
        queries.invalidateQueries({ queryKey: ['admin-channels'] }),
      ])
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const data = query.data,
    rows = data?.keys || [],
    current = data?.page || page,
    pages = data?.total_pages || 1
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) onClose()
        }}
      >
        <DialogContent className="admin-editor channel-key-manager max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('Multi-key management')} · {channel.name}
            </DialogTitle>
          </DialogHeader>
          {data && (
            <div className="channel-key-counts">
              <span>
                {t('Enabled')}: {data.enabled_count}
              </span>
              <span>
                {t('Disabled')}: {data.manual_disabled_count}
              </span>
              <span>
                {t('Auto disabled')}: {data.auto_disabled_count}
              </span>
            </div>
          )}
          <div className="console-toolbar">
            <label className="field">
              <span>{t('Status')}</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">{t('All')}</option>
                <option value="1">{t('Enabled')}</option>
                <option value="2">{t('Disabled')}</option>
                <option value="3">{t('Auto disabled')}</option>
              </select>
            </label>
            <Button variant="outline" onClick={() => query.refetch()}>
              {t('Refresh')}
            </Button>
          </div>
          <div className="action-buttons">
            {(['enable_all_keys', 'disable_all_keys', ...(sensitive ? ['delete_disabled_keys'] : [])] as ChannelKeyAction[]).map((action) => (
              <Button
                key={action}
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  mutation.reset()
                  setPending({ action })
                }}
              >
                {t(actionLabels[action])}
              </Button>
            ))}
          </div>
          {query.isPending ? (
            <LoadingState />
          ) : query.error ? (
            <ErrorState error={query.error} retry={() => query.refetch()} />
          ) : !rows.length ? (
            <EmptyState />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Index', 'Key preview', 'Status', 'Disabled time', 'Reason', 'Actions'].map((label) => (
                      <th key={label}>{t(label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.index}>
                      <td>{row.index + 1}</td>
                      <td>
                        <code>{row.key_preview?.endsWith('...') ? row.key_preview : '••••'}</code>
                      </td>
                      <td>{t(keyStatusLabels[row.status] || 'Unknown')}</td>
                      <td>{row.disabled_time ? new Date(row.disabled_time * 1000).toLocaleString(toIntlLocale(i18n.language)) : '—'}</td>
                      <td>{row.reason || '—'}</td>
                      <td>
                        <div className="action-buttons">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() => {
                              mutation.reset()
                              setPending({ action: row.status === 1 ? 'disable_key' : 'enable_key', index: row.index })
                            }}
                          >
                            {t(row.status === 1 ? 'Disable' : 'Enable')}
                          </Button>
                          {sensitive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={mutation.isPending}
                              onClick={() => {
                                mutation.reset()
                                setPending({ action: 'delete_key', index: row.index })
                              }}
                            >
                              {t('Delete')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-footer">
            <label>
              {t('Rows per page')}{' '}
              <select
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
              {t('Total')}: {data?.total || 0}
            </span>
            <div>
              <Button variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                {t('Previous')}
              </Button>
              <span>
                {current}/{pages}
              </span>
              <Button variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>
                {t('Next')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {pending && (
        <AdminConfirm
          title={t(actionLabels[pending.action])}
          description={`${channel.name}${pending.index !== undefined ? ` · #${pending.index + 1}` : ''}`}
          busy={mutation.isPending}
          onClose={() => setPending(null)}
          onConfirm={() => mutation.mutate(pending)}
        />
      )}
    </>
  )
}
