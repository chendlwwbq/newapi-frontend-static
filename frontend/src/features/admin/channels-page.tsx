'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power, Trash2, KeyRound, Activity, RefreshCw, Copy, Boxes, Tags, ArrowUpDown, Gauge } from 'lucide-react'
import { toast } from 'sonner'
import { api, apiResponse } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult, User } from '@/lib/api/types'
import { useQuotaFormatter } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/states'
import { CopyButton } from '@/components/shared/copy-button'
import { SecurityDialog } from '@/features/auth/secure-verification/security-dialog'
import { AdminSearch, AdminPagination, AdminConfirm, canChannel } from './shared'
import { ChannelEditor } from './channel-editor'
import { newChannel, type ChannelDraft } from './lib/channel-form'
import { CHANNEL_TYPES } from './channel-types'
import type { Channel } from './types'
import { ChannelKeyManager } from './channel-key-manager'
import { ChannelBatchDialog, ChannelTagManager, type ChannelBatchOperation } from './channel-batch-dialog'
import { OllamaChannelModels } from './ollama-channel-models'
import { ChannelPriorityDialog } from './channel-priority-dialog'
import { InferenceStatusDialog } from './inference-status-dialog'
import { CodexChannelDialog } from './codex-channel-dialog'
import { ChannelOperationsDialog } from './channel-operations-dialog'

export function ChannelsPage() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    format = useQuotaFormatter()
  const self = useQuery({ queryKey: ['self', bundle?.user.id], queryFn: () => api<User>('/api/user/self') }),
    user = self.data || bundle?.user
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [filter, setFilter] = useState(''),
    [status, setStatus] = useState('')
  const [editor, setEditor] = useState<ChannelDraft | null>(null),
    [deleting, setDeleting] = useState<Channel | null>(null),
    [keyTarget, setKeyTarget] = useState<Channel | null>(null),
    [secret, setSecret] = useState<{ name: string; key: string } | null>(null)
  const [selected, setSelected] = useState<number[]>([]),
    [batchDelete, setBatchDelete] = useState(false),
    [testing, setTesting] = useState<Channel | null>(null)
  const [batchOperation, setBatchOperation] = useState<ChannelBatchOperation | null>(null),
    [tagTarget, setTagTarget] = useState<string | null>(null),
    [keyManager, setKeyManager] = useState<Channel | null>(null),
    [ollama, setOllama] = useState<Channel | null>(null)
  const [priorityOrder, setPriorityOrder] = useState(false),
    [inference, setInference] = useState<Channel | null>(null),
    [operations, setOperations] = useState<Channel | null>(null),
    [codex, setCodex] = useState<Channel | null>(null)
  const pluginBind = user?.role === 100 || user?.permissions?.admin_permissions?.task_plugin?.bind === true
  const read = canChannel(user, 'read'),
    write = canChannel(user, 'write'),
    sensitive = canChannel(user, 'sensitive_write'),
    operate = canChannel(user, 'operate')
  const query = useQuery({
    queryKey: ['admin-channels', bundle?.user.id, page, keyword, status],
    enabled: read,
    queryFn: ({ signal }) =>
      api<PageResult<Channel>>(
        `/api/channel/${keyword ? 'search' : ''}?p=${page}&page_size=20&keyword=${encodeURIComponent(keyword)}&status=${encodeURIComponent(status)}`,
        { signal }
      ),
  })
  function changed() {
    setSelected([])
    void queries.invalidateQueries({ queryKey: ['admin-channels'] })
    toast.success(t('Saved'))
  }
  const action = useMutation({
    mutationFn: (request: { path: string; method: string; body?: unknown }) => api(request.path, request),
    onSuccess: () => {
      setDeleting(null)
      setBatchDelete(false)
      changed()
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const test = useMutation({
    mutationFn: (channel: Channel) => apiResponse(`/api/channel/test/${channel.id}`),
    onSuccess: () => {
      setTesting(null)
      toast.success(t('Test successful'))
      void queries.invalidateQueries({ queryKey: ['admin-channels'] })
    },
    onError: (error) => {
      toast.error(t(error.message))
      setTesting(null)
    },
  })
  async function edit(channel: Channel) {
    try {
      const data = await api<Channel>(`/api/channel/${channel.id}`)
      setEditor({ ...data, key: '', mode: 'single', key_mode: 'append', multi_key_mode: data.channel_info?.multi_key_mode || 'random' })
    } catch (error) {
      toast.error(t((error as Error).message))
    }
  }
  const items = query.data?.items || []
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Channels')}</h1>
          <p>{t('Configure upstream models, routing and credentials.')}</p>
        </div>
        <div className="action-buttons">
          <Button variant="outline" aria-label={t('Refresh')} onClick={() => query.refetch()}>
            <RefreshCw size={14} />
          </Button>
          {read && (
            <Button variant="outline" onClick={() => setPriorityOrder(true)}>
              <ArrowUpDown size={14} />
              {t('Priority order')}
            </Button>
          )}
          {sensitive && (
            <Button onClick={() => setEditor({ ...newChannel })}>
              <Plus size={14} />
              {t('Add channel')}
            </Button>
          )}
        </div>
      </div>
      {!read ? (
        <EmptyState title={t('Unauthorized, insufficient privileges')} />
      ) : (
        <>
          <AdminSearch
            onSearch={(value) => {
              setPage(1)
              setKeyword(value)
              setStatus(filter)
              setSelected([])
            }}
          >
            <FilterSelect
              className="toolbar-filter-select"
              label={t('Status')}
              hideLabel
              value={filter}
              onChange={setFilter}
              options={[
                { value: '', label: t('All') },
                { value: '1', label: t('Enabled') },
                { value: 'disabled', label: t('Disabled') },
              ]}
            />
          </AdminSearch>
          {!!selected.length && (
            <div className="admin-selection">
              <span>
                {selected.length} {t('Selected')}
              </span>
              {write && (
                <Button variant="outline" onClick={() => setBatchOperation({ kind: 'tag', ids: [...selected] })}>
                  {t('Set tag')}
                </Button>
              )}
              {operate && (
                <>
                  <Button
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ path: '/api/channel/status/batch', method: 'POST', body: { ids: selected, status: 1 } })}
                  >
                    {t('Enable')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ path: '/api/channel/status/batch', method: 'POST', body: { ids: selected, status: 2 } })}
                  >
                    {t('Disable')}
                  </Button>
                </>
              )}
              {sensitive && (
                <Button variant="destructive" onClick={() => setBatchDelete(true)}>
                  {t('Delete')}
                </Button>
              )}
            </div>
          )}
          {query.error ? (
            <ErrorState error={query.error} retry={() => query.refetch()} />
          ) : query.isPending ? (
            <LoadingState />
          ) : (
            <>
              <div className="table-wrap channels-management-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label={t('Select all')}
                          checked={!!items.length && items.every((item) => selected.includes(item.id))}
                          onChange={(event) => setSelected(event.target.checked ? items.map((item) => item.id) : [])}
                        />
                      </th>
                      {['Name', 'Type', 'Status', 'Models', 'Group', 'Priority', 'Total usage', 'Actions'].map((label) => (
                        <th key={label}>{t(label)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((channel) => (
                      <tr key={channel.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${t('Select')} ${channel.name}`}
                            checked={selected.includes(channel.id)}
                            onChange={(event) =>
                              setSelected((current) => (event.target.checked ? [...current, channel.id] : current.filter((id) => id !== channel.id)))
                            }
                          />
                        </td>
                        <td>
                          <strong>{channel.name}</strong>
                          <div className="small-note">
                            #{channel.id}
                            {channel.tag && ` · ${channel.tag}`}
                            {channel.tag && (write || operate) && (
                              <button
                                className="icon-button"
                                aria-label={`${t('Manage tag')} ${channel.tag}`}
                                onClick={() => setTagTarget(channel.tag)}
                              >
                                <Tags size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td>{t(CHANNEL_TYPES[channel.type as keyof typeof CHANNEL_TYPES] || 'Unknown')}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              channel.status === 1
                                ? 'success'
                                : channel.status === 3
                                  ? 'bg-destructive/10 text-destructive'
                                  : ''
                            }`}
                          >
                            {channel.status === 1 ? (
                              <span className="relative flex size-2" aria-hidden="true">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                              </span>
                            ) : (
                              <span
                                className={`inline-block size-2 rounded-full ${channel.status === 3 ? 'bg-red-500' : 'bg-muted-foreground/60'}`}
                                aria-hidden="true"
                              />
                            )}
                            {t(channel.status === 1 ? 'Enabled' : channel.status === 3 ? 'Auto disabled' : 'Disabled')}
                          </span>
                          <div
                            className={`small-note mt-1 ${
                              channel.test_time && channel.response_time > 5000 ? 'text-amber-600 dark:text-amber-400' : ''
                            }`}
                          >
                            {channel.test_time ? `${channel.response_time} ms` : '—'}
                          </div>
                        </td>
                        <td>
                          <span className="admin-models" title={channel.models}>
                            {channel.models}
                          </span>
                        </td>
                        <td>{channel.group}</td>
                        <td>
                          {channel.priority ?? 0}
                          <span className="small-note"> / {channel.weight ?? 0}</span>
                        </td>
                        <td>{format(channel.used_quota)}</td>
                        <td>
                          <div className="action-buttons">
                            {write && (channel.type !== 61 || pluginBind || !sensitive) && (
                              <Button variant="ghost" size="icon" aria-label={`${t('Edit')} ${channel.name}`} onClick={() => edit(channel)}>
                                <Pencil size={14} />
                              </Button>
                            )}
                            {operate && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={action.isPending}
                                  aria-label={t(channel.status === 1 ? 'Disable' : 'Enable')}
                                  onClick={() =>
                                    action.mutate({
                                      path: `/api/channel/${channel.id}/status`,
                                      method: 'POST',
                                      body: { status: channel.status === 1 ? 2 : 1 },
                                    })
                                  }
                                >
                                  <Power size={14} />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label={`${t('Test')} ${channel.name}`} onClick={() => setTesting(channel)}>
                                  <Activity size={14} />
                                </Button>
                              </>
                            )}
                            {operate && channel.channel_info?.is_multi_key && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${t('Multi-key management')} ${channel.name}`}
                                onClick={() => setKeyManager(channel)}
                              >
                                <Boxes size={14} />
                              </Button>
                            )}
                            {sensitive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${t('Copy channel')} ${channel.name}`}
                                onClick={() => setBatchOperation({ kind: 'copy', channel })}
                              >
                                <Copy size={14} />
                              </Button>
                            )}
                            {channel.type === 57 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${t('Codex Usage')} ${channel.name}`}
                                onClick={() => setCodex(channel)}
                              >
                                <Gauge size={14} />
                              </Button>
                            )}
                            {[62, 63].includes(channel.type) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${t(channel.type === 63 ? 'SGLang status' : 'vLLM status')} ${channel.name}`}
                                onClick={() => setInference(channel)}
                              >
                                <Gauge size={14} />
                              </Button>
                            )}
                            {sensitive && channel.type === 4 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${t('Ollama Models')} ${channel.name}`}
                                onClick={() => setOllama(channel)}
                              >
                                <Boxes size={14} />
                              </Button>
                            )}
                            {user?.role === 100 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${t('View key')} ${channel.name}`}
                                onClick={() => setKeyTarget(channel)}
                              >
                                <KeyRound size={14} />
                              </Button>
                            )}
                            {sensitive && (
                              <Button variant="ghost" size="icon" aria-label={`${t('Delete')} ${channel.name}`} onClick={() => setDeleting(channel)}>
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!items.length && <EmptyState title={t('No data yet')} />}
              <AdminPagination
                page={page}
                total={query.data.total}
                onPage={(page) => {
                  setPage(page)
                  setSelected([])
                }}
              />
            </>
          )}
        </>
      )}
      {batchOperation && (
        <ChannelBatchDialog
          operation={batchOperation}
          onClose={() => {
            setBatchOperation(null)
            setSelected([])
          }}
        />
      )}
      {tagTarget && <ChannelTagManager tag={tagTarget} write={write} operate={operate} sensitive={sensitive} onClose={() => setTagTarget(null)} />}
      {keyManager && bundle && (
        <ChannelKeyManager
          key={keyManager.id}
          channel={keyManager}
          ownerId={bundle.user.id}
          sensitive={sensitive}
          onClose={() => setKeyManager(null)}
        />
      )}
      {ollama && bundle && (
        <OllamaChannelModels
          key={ollama.id}
          channel={ollama}
          ownerId={bundle.user.id}
          operate={operate}
          write={write}
          onClose={() => setOllama(null)}
        />
      )}
      {priorityOrder && bundle && (
        <ChannelPriorityDialog channels={items} ownerId={bundle.user.id} write={write} onClose={() => setPriorityOrder(false)} />
      )}
      {inference && bundle && (
        <InferenceStatusDialog
          key={inference.id}
          channel={inference}
          ownerId={bundle.user.id}
          operate={operate}
          write={write}
          onClose={() => setInference(null)}
          onOperations={() => {
            setOperations(inference)
            setInference(null)
          }}
        />
      )}
      {codex && bundle && (
        <CodexChannelDialog
          key={codex.id}
          channel={codex}
          ownerId={bundle.user.id}
          operate={operate}
          sensitive={sensitive}
          onClose={() => setCodex(null)}
        />
      )}
      {operations && <ChannelOperationsDialog channel={operations} user={user} onClose={() => setOperations(null)} />}
      {editor && (
        <ChannelEditor initial={editor} sensitive={sensitive} pluginBind={pluginBind} ownerId={bundle!.user.id} onClose={() => setEditor(null)} />
      )}
      {deleting && (
        <AdminConfirm
          title={t('Delete channel')}
          description={deleting.name}
          busy={action.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => action.mutate({ path: `/api/channel/${deleting.id}`, method: 'DELETE' })}
        />
      )}
      {batchDelete && (
        <AdminConfirm
          title={t('Delete channels')}
          description={String(selected.length)}
          busy={action.isPending}
          onClose={() => setBatchDelete(false)}
          onConfirm={() => action.mutate({ path: '/api/channel/batch', method: 'POST', body: { ids: selected } })}
        />
      )}
      {testing && (
        <AdminConfirm
          title={t('Test channel')}
          description={t('This sends a real request to the upstream provider and may incur charges.')}
          busy={test.isPending}
          onClose={() => setTesting(null)}
          onConfirm={() => test.mutate(testing)}
        />
      )}
      {keyTarget && (
        <SecurityDialog
          operation={{ scope: 'channel.key.read', context: { channel_id: keyTarget.id } }}
          title="View key"
          onClose={() => setKeyTarget(null)}
          onAuthorized={async (proof, signal) => {
            const data = await api<{ key: string }>(`/api/channel/${keyTarget.id}/key`, {
              method: 'POST',
              headers: { 'X-Security-Proof': proof },
              signal,
            })
            setSecret({ name: keyTarget.name, key: data.key })
          }}
        />
      )}
      <Dialog
        open={!!secret}
        onOpenChange={(open) => {
          if (!open) setSecret(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{secret?.name}</DialogTitle>
            <DialogDescription>{t('API key')}</DialogDescription>
          </DialogHeader>
          {secret && (
            <div className="code-preview">
              <CopyButton value={secret.key} />
              <pre className="admin-secret">{secret.key}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
