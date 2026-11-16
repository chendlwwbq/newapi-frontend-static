'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult, User } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminSearch, AdminPagination, AdminConfirm, canChannel } from './shared'
import { OpsNav } from './ops-nav'
import { ChannelOperationsDialog } from './channel-operations-dialog'
import { CHANNEL_TYPES } from './channel-types'
import type { Channel } from './types'

const actions = {
  test: {
    path: '/api/channel/test',
    method: 'GET',
    title: 'Test all enabled channels',
    description: 'This starts a background task that sends real requests and may incur provider charges.',
  },
  detect: {
    path: '/api/channel/upstream_updates/detect_all',
    method: 'POST',
    title: 'Detect all model changes',
    description: 'This checks upstream model lists and may apply configured automatic additions.',
  },
  balance: {
    path: '/api/channel/update_balance',
    method: 'GET',
    title: 'Refresh all balances',
    description: 'Query enabled channels. Channels with no balance may be disabled by the native gateway.',
  },
}
export function OpsChannels() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const self = useQuery({ queryKey: ['self', bundle?.user.id], queryFn: () => api<User>('/api/user/self') }),
    user = self.data || bundle?.user
  const read = canChannel(user, 'read'),
    operate = canChannel(user, 'operate')
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [channel, setChannel] = useState<Channel | null>(null),
    [confirm, setConfirm] = useState<keyof typeof actions | null>(null),
    [taskId, setTaskId] = useState('')
  const query = useQuery({
    queryKey: ['ops-channels', bundle?.user.id, keyword, page],
    enabled: read,
    queryFn: ({ signal }) =>
      api<PageResult<Channel>>(`/api/channel/${keyword ? 'search' : ''}?p=${page}&page_size=20&keyword=${encodeURIComponent(keyword)}`, { signal }),
  })
  const action = useMutation({
    mutationFn: (kind: keyof typeof actions) => api<{ task_id?: string } | undefined>(actions[kind].path, { method: actions[kind].method }),
    onSuccess: (result) => {
      setTaskId(result?.task_id || '')
      setConfirm(null)
      void queries.invalidateQueries({ queryKey: ['system-tasks'] })
      void query.refetch()
      toast.success(t('Saved'))
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) setTaskId((error.data as { task_id?: string })?.task_id || '')
      setConfirm(null)
      toast.error(t(error.message))
    },
  })
  if (!read) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Channel operations')}</h1>
          <p>{t('Test channels, inspect provider balances and review upstream model changes.')}</p>
        </div>
        <Link className="text-link" href="/channels">
          {t('Channels')} ↗
        </Link>
      </div>
      <OpsNav />
      {operate && (
        <div className="action-buttons admin-selection">
          {Object.entries(actions).map(([key, item]) => (
            <Button variant="outline" disabled={action.isPending} key={key} onClick={() => setConfirm(key as keyof typeof actions)}>
              {t(item.title)}
            </Button>
          ))}
        </div>
      )}
      {taskId && (
        <p className="admin-notice">
          {t('Task ID')}: <code>{taskId}</code>{' '}
          {bundle?.user.role === 100 && (
            <Link className="text-link" href="/ops/tasks">
              {t('System tasks')} ↗
            </Link>
          )}
        </p>
      )}
      <AdminSearch
        onSearch={(value) => {
          setKeyword(value)
          setPage(1)
        }}
      />
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Channel', 'Type', 'Status', 'Response time', 'Models', 'Actions'].map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <div className="small-note">#{item.id}</div>
                    </td>
                    <td>{t(CHANNEL_TYPES[item.type as keyof typeof CHANNEL_TYPES] || 'Unknown')}</td>
                    <td>{t(item.status === 1 ? 'Enabled' : 'Disabled')}</td>
                    <td>{item.test_time ? `${item.response_time} ms` : '—'}</td>
                    <td>
                      <span className="admin-models" title={item.models}>
                        {item.models}
                      </span>
                    </td>
                    <td>
                      <Button variant="outline" onClick={() => setChannel(item)}>
                        {t('Details')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.items.length && <EmptyState />}
          <AdminPagination page={page} total={query.data.total} onPage={setPage} />
        </>
      )}
      {channel && <ChannelOperationsDialog channel={channel} user={user} onClose={() => setChannel(null)} />}
      {confirm && (
        <AdminConfirm
          title={t(actions[confirm].title)}
          description={t(actions[confirm].description)}
          busy={action.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => action.mutate(confirm)}
        />
      )}
    </>
  )
}
