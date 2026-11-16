'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, apiResponse } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm, canChannel } from './shared'
import type { User } from '@/lib/api/types'
import type { Channel } from './types'

type ModelDiff = { add_models: string[]; remove_models: string[]; last_check_time?: number; auto_added_models?: number }
type Operation = 'test' | 'balance' | 'fetch' | 'detect' | 'apply'
const endpoints = [
  ['', 'Automatic'],
  ['openai', 'OpenAI Chat'],
  ['openai-response', 'OpenAI Responses'],
  ['openai-response-compact', 'OpenAI Response Compaction'],
  ['anthropic', 'Anthropic'],
  ['gemini', 'Gemini'],
  ['embeddings', 'Embeddings'],
  ['image-generation', 'Image generation'],
  ['jina-rerank', 'Rerank'],
]
export function ChannelOperationsDialog({ channel, user, onClose }: { channel: Channel; user?: User; onClose: () => void }) {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const operate = canChannel(user || bundle?.user, 'operate'),
    write = canChannel(user || bundle?.user, 'write')
  const [model, setModel] = useState(channel.test_model || channel.models.split(',')[0] || ''),
    [endpoint, setEndpoint] = useState(''),
    [stream, setStream] = useState(false)
  const [confirmation, setConfirmation] = useState<Operation | null>(null),
    [message, setMessage] = useState(''),
    [models, setModels] = useState<string[] | null>(null)
  const [diff, setDiff] = useState<ModelDiff | null>(null),
    [adds, setAdds] = useState<string[]>([]),
    [removes, setRemoves] = useState<string[]>([]),
    [ignored, setIgnored] = useState<string[]>([])
  const policy = useQuery({
    queryKey: ['channel-ops-policy', channel.id, bundle?.user.id],
    queryFn: ({ signal }) =>
      api<{ retry_times: number; request_policy: { automatic_disable: boolean; source: string } }>(
        `/api/channel/ops?auto_ban=${channel.auto_ban === 1}`,
        { signal }
      ),
  })
  const action = useMutation({
    mutationFn: async (operation: Operation) => {
      if (operation === 'test') {
        const params = new URLSearchParams({
          model,
          endpoint_type: endpoint,
          stream: String(stream && !['embeddings', 'image-generation', 'jina-rerank', 'openai-response-compact'].includes(endpoint)),
        })
        const result = (await apiResponse<never>(`/api/channel/test/${channel.id}?${params}`)) as { time?: number }
        setMessage(`${t('Test successful')} · ${(result.time ?? 0).toFixed(3)} s`)
      } else if (operation === 'balance') {
        const result = (await apiResponse<never>(`/api/channel/update_balance/${channel.id}`)) as { balance?: number; raw_response?: string }
        setMessage(result.raw_response || `${t('Upstream balance')}: ${result.balance ?? '—'}`)
      } else if (operation === 'fetch') {
        setModels(await api<string[]>(`/api/channel/fetch_models/${channel.id}`))
      } else if (operation === 'detect') {
        const result = await api<ModelDiff>('/api/channel/upstream_updates/detect', { method: 'POST', body: { id: channel.id } })
        setDiff({ ...result, add_models: result.add_models || [], remove_models: result.remove_models || [] })
        setAdds([])
        setRemoves([])
        setIgnored([])
        setMessage(`${t('Automatically added models')}: ${result.auto_added_models ?? 0}`)
      } else {
        const result = await api<{
          added_models: string[]
          removed_models: string[]
          ignored_models: string[]
          remaining_models: string[]
          remaining_remove_models: string[]
        }>('/api/channel/upstream_updates/apply', {
          method: 'POST',
          body: { id: channel.id, add_models: adds, remove_models: removes, ignore_models: ignored },
        })
        setDiff({ add_models: result.remaining_models || [], remove_models: result.remaining_remove_models || [] })
        setAdds([])
        setRemoves([])
        setIgnored([])
        setMessage(
          `${t('Added')}: ${result.added_models?.length ?? 0} · ${t('Removed')}: ${result.removed_models?.length ?? 0} · ${t('Ignored')}: ${result.ignored_models?.length ?? 0}`
        )
      }
    },
    onSuccess: (_result, operation) => {
      setConfirmation(null)
      void queries.invalidateQueries({ queryKey: ['admin-channels'] })
      void queries.invalidateQueries({ queryKey: ['ops-channels'] })
      if (operation === 'apply') toast.success(t('Saved'))
    },
    onError: (error) => {
      setConfirmation(null)
      toast.error(t(error.message))
    },
  })
  const nonStream = ['embeddings', 'image-generation', 'jina-rerank', 'openai-response-compact'].includes(endpoint)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !action.isPending) onClose()
      }}
    >
      <DialogContent className="admin-editor" showCloseButton={!action.isPending}>
        <DialogHeader>
          <DialogTitle>{channel.name}</DialogTitle>
          <DialogDescription>
            {t('Channel operations')} · #{channel.id}
          </DialogDescription>
        </DialogHeader>
        {policy.error ? (
          <ErrorState error={policy.error} retry={() => policy.refetch()} />
        ) : policy.isPending ? (
          <LoadingState />
        ) : (
          <p className="admin-notice">
            {t('Retry count')}: {policy.data.retry_times} · {t('Automatic disable')}:{' '}
            {t(policy.data.request_policy.automatic_disable ? 'Enabled' : 'Disabled')} · {t('Source')}: {policy.data.request_policy.source}
          </p>
        )}
        <fieldset disabled={action.isPending} className="admin-pricing-fields">
          <div className="admin-form-grid">
            <label className="field">
              <span>{t('Test model')}</span>
              <input value={model} onChange={(event) => setModel(event.target.value)} />
            </label>
            <label className="field">
              <span>{t('Endpoint type')}</span>
              <select value={endpoint} onChange={(event) => setEndpoint(event.target.value)}>
                {endpoints.map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={stream && !nonStream} disabled={nonStream} onChange={(event) => setStream(event.target.checked)} />
            {t('Streaming')}
          </label>
          <div className="action-buttons admin-selection">
            {operate && (
              <>
                <Button variant="outline" onClick={() => setConfirmation('test')}>
                  {t('Test channel')}
                </Button>
                <Button
                  variant="outline"
                  disabled={channel.channel_info?.is_multi_key || channel.type === 61}
                  onClick={() => setConfirmation('balance')}
                >
                  {t('Refresh upstream balance')}
                </Button>
                <Button variant="outline" onClick={() => action.mutate('fetch')}>
                  {t('Fetch upstream models')}
                </Button>
                <Button variant="outline" onClick={() => setConfirmation('detect')}>
                  {t('Detect model changes')}
                </Button>
              </>
            )}
          </div>
          {message && (
            <pre className="admin-pricing-effective" role="status">
              {message}
            </pre>
          )}
          {models && (
            <section>
              <h3>
                {t('Upstream models')} ({models.length})
              </h3>
              <pre className="admin-pricing-effective">{models.join('\n')}</pre>
              {!models.length && <EmptyState />}
            </section>
          )}
          {diff && (
            <section>
              <div className="console-page-heading">
                <h3>{t('Model changes')}</h3>
                {write && (
                  <Button disabled={!adds.length && !removes.length && !ignored.length} onClick={() => setConfirmation('apply')}>
                    {t('Apply selected changes')}
                  </Button>
                )}
              </div>
              <p className="small-note">{t('Choose additions, removals or ignored additions. Only selected changes are applied.')}</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['Model', 'Change', 'Selection'].map((label) => (
                        <th key={label}>{t(label)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diff.add_models.map((name) => (
                      <tr key={`add:${name}`}>
                        <td>{name}</td>
                        <td>{t('Added')}</td>
                        <td>
                          <select
                            aria-label={`${t('Selection')} ${name}`}
                            disabled={!write}
                            value={adds.includes(name) ? 'add' : ignored.includes(name) ? 'ignore' : ''}
                            onChange={(event) => {
                              setAdds((current) => [...current.filter((item) => item !== name), ...(event.target.value === 'add' ? [name] : [])])
                              setIgnored((current) => [
                                ...current.filter((item) => item !== name),
                                ...(event.target.value === 'ignore' ? [name] : []),
                              ])
                            }}
                          >
                            <option value="">{t('Keep pending')}</option>
                            <option value="add">{t('Add')}</option>
                            <option value="ignore">{t('Ignore')}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {diff.remove_models.map((name) => (
                      <tr key={`remove:${name}`}>
                        <td>{name}</td>
                        <td>{t('Removed upstream')}</td>
                        <td>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              disabled={!write}
                              checked={removes.includes(name)}
                              onChange={(event) =>
                                setRemoves((current) => (event.target.checked ? [...current, name] : current.filter((item) => item !== name)))
                              }
                            />
                            {t('Remove local model')}
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!diff.add_models.length && !diff.remove_models.length && <EmptyState title={t('No model changes')} />}
            </section>
          )}
        </fieldset>
        {confirmation && (
          <AdminConfirm
            title={t(
              {
                test: 'Test channel',
                balance: 'Refresh upstream balance',
                fetch: 'Fetch upstream models',
                detect: 'Detect model changes',
                apply: 'Apply selected changes',
              }[confirmation]
            )}
            description={t(
              confirmation === 'test'
                ? 'This sends a real request to the upstream provider and may incur charges.'
                : confirmation === 'detect'
                  ? 'Detection contacts the upstream and may add models when automatic addition is configured.'
                  : confirmation === 'apply'
                    ? 'Apply the selected model additions, removals and ignores to this channel.'
                    : 'Query the provider for this channel balance.'
            )}
            busy={action.isPending}
            onClose={() => setConfirmation(null)}
            onConfirm={() => action.mutate(confirmation)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
