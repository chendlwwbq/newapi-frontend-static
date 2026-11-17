'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SSE } from 'sse.js'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { freshAuthHeaders } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminConfirm } from './shared'
import type { Channel } from './types'

type OllamaProgress = { status?: string; completed?: number; total?: number; error?: string; message?: string }
export function OllamaChannelModels({
  channel,
  ownerId,
  operate,
  write,
  onClose,
}: {
  channel: Channel
  ownerId: number
  operate: boolean
  write: boolean
  onClose: () => void
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [name, setName] = useState(''),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [confirmation, setConfirmation] = useState<{ action: 'pull' | 'delete' | 'replace'; model: string } | null>(null)
  const [progress, setProgress] = useState<OllamaProgress | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    source = useRef<SSE | null>(null),
    generation = useRef(0)
  const version = useQuery({
    queryKey: ['ollama-version', ownerId, channel.id],
    queryFn: ({ signal }) => api<{ version: string }>(`/api/channel/ollama/version/${channel.id}`, { signal }),
  })
  const models = useQuery({
    queryKey: ['ollama-models', ownerId, channel.id],
    enabled: operate,
    queryFn: ({ signal }) => api<string[]>(`/api/channel/fetch_models/${channel.id}`, { signal }),
  })
  useEffect(
    () => () => {
      generation.current++
      source.current?.close()
    },
    []
  )
  function refresh() {
    void models.refetch()
    void version.refetch()
    void queries.invalidateQueries({ queryKey: ['admin-channels'] })
  }
  const mutation = useMutation({
    mutationFn: async (action: 'delete' | 'append' | 'replace') => {
      if (action === 'delete')
        return api('/api/channel/ollama/delete', { method: 'DELETE', body: { channel_id: channel.id, model_name: confirmation!.model } })
      const current = await api<Channel>(`/api/channel/${channel.id}`)
      const next = action === 'append' ? [...new Set([...current.models.split(',').filter(Boolean), ...selected])] : selected
      return api('/api/channel', { method: 'PUT', body: { id: channel.id, models: next.join(',') } })
    },
    onSuccess: () => {
      setConfirmation(null)
      setSelected([])
      refresh()
      toast.success(t('Saved'))
    },
    onError: (error) => setError(error.message),
  })
  function stopWatching() {
    generation.current++
    source.current?.close()
    source.current = null
    setBusy(false)
  }
  async function pull() {
    const request = ++generation.current
    setConfirmation(null)
    setError('')
    setProgress(null)
    setBusy(true)
    try {
      const headers = await freshAuthHeaders()
      if (request !== generation.current) return
      const stream = new SSE('/api/channel/ollama/pull/stream', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        payload: JSON.stringify({ channel_id: channel.id, model_name: name.trim() }),
      })
      source.current = stream
      const finish = (message?: string) => {
        if (request !== generation.current) return
        generation.current++
        stream.close()
        source.current = null
        setBusy(false)
        if (message) setError(message)
        else {
          setName('')
          refresh()
          toast.success(t('Model pulled successfully'))
        }
      }
      stream.addEventListener('message', (event: { data?: string }) => {
        if (request !== generation.current) return
        if (event.data === '[DONE]') {
          finish('Connection closed')
          return
        }
        try {
          const data = JSON.parse(event.data || '') as OllamaProgress
          if (data.error) finish(data.error)
          else if (data.message) finish()
          else setProgress(data)
        } catch {
          finish('Invalid server response')
        }
      })
      stream.addEventListener('error', () => finish('Model pull failed'))
      stream.stream()
    } catch (error) {
      if (request === generation.current) {
        setBusy(false)
        setError((error as Error).message)
      }
    }
  }
  const rows = (models.data || []).filter((model) => model.toLowerCase().includes(search.trim().toLowerCase())),
    percent = progress?.total ? Math.max(0, Math.min(100, ((progress.completed || 0) / progress.total) * 100)) : 0
  const working = busy || mutation.isPending
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            stopWatching()
            onClose()
          }
        }}
      >
        <DialogContent className="admin-editor ollama-channel-models max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('Ollama Models')} · {channel.name}
            </DialogTitle>
          </DialogHeader>
          <p className="small-note">
            {t('Version')}: {version.data?.version || '—'}
          </p>
          {version.error && <ErrorState error={version.error} retry={() => version.refetch()} />}
          <p className="small-note">{t('Closing this dialog stops progress updates; the server may continue pulling the model.')}</p>
          <form
            className="console-toolbar"
            onSubmit={(event) => {
              event.preventDefault()
              setConfirmation({ action: 'pull', model: name.trim() })
            }}
          >
            <label className="field">
              <span>{t('Model name')}</span>
              <input required value={name} disabled={working} onChange={(event) => setName(event.target.value)} placeholder="llama3.2:latest" />
            </label>
            <Button type="submit" disabled={working || !name.trim()}>
              {t('Pull model')}
            </Button>
            {busy && (
              <Button type="button" variant="outline" onClick={stopWatching}>
                {t('Stop watching')}
              </Button>
            )}
          </form>
          {progress && (
            <div aria-live="polite">
              <p>{progress.status}</p>
              {!!progress.total && (
                <>
                  <progress max={100} value={percent} />
                  <span>{percent.toFixed(1)}%</span>
                </>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {t(error)}
            </p>
          )}
          {!operate ? (
            <p>{t('Unauthorized, insufficient privileges')}</p>
          ) : (
            <>
              <div className="console-toolbar">
                <label className="field">
                  <span>{t('Search')}</span>
                  <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <Button variant="outline" disabled={working} onClick={refresh}>
                  {t('Refresh')}
                </Button>
              </div>
              {models.isPending ? (
                <LoadingState />
              ) : models.error ? (
                <ErrorState error={models.error} retry={() => models.refetch()} />
              ) : !rows.length ? (
                <EmptyState />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label={t('Select all')}
                            checked={!!rows.length && rows.every((model) => selected.includes(model))}
                            onChange={(event) =>
                              setSelected((previous) =>
                                event.target.checked ? [...new Set([...previous, ...rows])] : previous.filter((model) => !rows.includes(model))
                              )
                            }
                          />
                        </th>
                        <th>{t('Model')}</th>
                        <th>{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((model) => (
                        <tr key={model}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`${t('Select')} ${model}`}
                              checked={selected.includes(model)}
                              onChange={(event) =>
                                setSelected((previous) => (event.target.checked ? [...previous, model] : previous.filter((value) => value !== model)))
                              }
                            />
                          </td>
                          <td>
                            <code>{model}</code>
                          </td>
                          <td>
                            <Button size="sm" variant="ghost" disabled={working} onClick={() => setConfirmation({ action: 'delete', model })}>
                              {t('Delete')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {write && (
                <div className="action-buttons">
                  <span>
                    {selected.length} {t('Selected')}
                  </span>
                  <Button
                    variant="outline"
                    disabled={working || !selected.length}
                    onClick={() => {
                      setError('')
                      mutation.mutate('append')
                    }}
                  >
                    {t('Append')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={working || !selected.length}
                    onClick={() => setConfirmation({ action: 'replace', model: selected.join(', ') })}
                  >
                    {t('Replace')}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {confirmation && (
        <AdminConfirm
          title={t(confirmation.action === 'pull' ? 'Pull model' : confirmation.action === 'delete' ? 'Delete model' : 'Replace models')}
          description={`${channel.name} · ${confirmation.model}`}
          busy={working}
          onClose={() => setConfirmation(null)}
          onConfirm={() => {
            setError('')
            if (confirmation.action === 'pull') void pull()
            else mutation.mutate(confirmation.action)
          }}
        />
      )}
    </>
  )
}
