'use client'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { ModelMetadata } from './metadata-types'
import { runMetadataBatch, type RecordResult } from './lib/metadata-batch'
import { VendorOperation } from './vendor-operation'

export function ModelBatchActions({
  selected,
  onClear,
  onDone,
}: {
  selected: ModelMetadata[]
  onClear: () => void
  onDone: (ids: number[]) => void
}) {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    request = useRef<AbortController | null>(null)
  const [action, setAction] = useState<'show' | 'hide' | 'delete' | 'assign' | null>(null),
    [snapshot, setSnapshot] = useState<ModelMetadata[]>([]),
    [busy, setBusy] = useState(false),
    [channels, setChannels] = useState(false),
    [pricing, setPricing] = useState(false),
    [error, setError] = useState('')
  const [results, setResults] = useState<RecordResult<ModelMetadata>[] | null>(null),
    [deleted, setDeleted] = useState<{ deleted_count: number; updated_channels: number } | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  function open(value: NonNullable<typeof action>) {
    setAction(value)
    setSnapshot([...selected])
    setResults(null)
    setDeleted(null)
    setError('')
    setChannels(false)
    setPricing(false)
  }
  async function execute(retry = false) {
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      if (action === 'delete') {
        const result = await api<{ deleted_count: number; updated_channels: number }>('/api/models/delete', {
          method: 'POST',
          body: {
            model_ids: snapshot.map((model) => model.id),
            remove_from_channels: channels,
            remove_pricing: pricing && bundle?.user.role === 100,
          },
          signal: controller.signal,
        })
        setDeleted(result)
        onDone(snapshot.map((model) => model.id))
      } else {
        const pending = retry ? results!.filter((result) => result.error).map((result) => result.item) : snapshot
        const next = await runMetadataBatch(
          pending,
          (model) =>
            api('/api/models?status_only=true', {
              method: 'PUT',
              body: { id: model.id, status: action === 'show' ? 1 : 0 },
              signal: controller.signal,
            }),
          controller.signal
        )
        if (controller.signal.aborted) return
        setResults((previous) => [...(retry ? previous!.filter((result) => !result.error) : []), ...next])
        onDone(next.filter((result) => !result.error).map((result) => result.item.id))
      }
      for (const key of ['admin-models', 'catalog', 'admin-vendors', 'ops-channels', 'admin-channels', 'model-pricing-config'])
        void queries.invalidateQueries({ queryKey: [key] })
    } catch (failure) {
      if (!controller.signal.aborted) setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="metadata-batch-toolbar">
        <span>
          {t('Selected records')}: {selected.length}
        </span>
        {(['show', 'hide', 'assign', 'delete'] as const).map((value) => (
          <Button key={value} variant="outline" disabled={!selected.length} onClick={() => open(value)}>
            {t(value === 'show' ? 'Show' : value === 'hide' ? 'Hide' : value === 'assign' ? 'Assign vendor' : 'Delete')}
          </Button>
        ))}
        <Button variant="ghost" disabled={!selected.length} onClick={onClear}>
          {t('Clear selection')}
        </Button>
      </div>
      {action === 'assign' ? (
        <VendorOperation
          input={{ action: 'assign', model_ids: snapshot.map((model) => model.id) }}
          onClose={() => setAction(null)}
          onSaved={() => onDone(snapshot.map((model) => model.id))}
        />
      ) : (
        action && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open && !busy) setAction(null)
            }}
          >
            <DialogContent className="admin-editor">
              <DialogHeader>
                <DialogTitle>{t(action === 'delete' ? 'Delete model metadata' : action === 'show' ? 'Show models' : 'Hide models')}</DialogTitle>
                <DialogDescription>
                  {t('Selected records')}: {snapshot.length}
                </DialogDescription>
              </DialogHeader>
              {!results && !deleted && (
                <>
                  <div className="metadata-selection-list">
                    {snapshot.map((model) => (
                      <code key={model.id}>{model.model_name}</code>
                    ))}
                  </div>
                  {action === 'delete' && (
                    <>
                      <p className="small-note">
                        {t('Deleting metadata alone keeps channel configuration and pricing. Channel removal requires exact-match model records.')}
                      </p>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={channels} disabled={busy} onChange={(event) => setChannels(event.target.checked)} />
                        {t('Remove models from channels')}
                      </label>
                      {bundle?.user.role === 100 && (
                        <label className="checkbox-label">
                          <input type="checkbox" checked={pricing} disabled={busy} onChange={(event) => setPricing(event.target.checked)} />
                          {t('Remove model pricing overrides')}
                        </label>
                      )}
                    </>
                  )}
                  <Button variant={action === 'delete' ? 'destructive' : 'default'} disabled={busy} onClick={() => execute()}>
                    {t(busy ? 'Loading' : 'Confirm')}
                  </Button>
                </>
              )}
              {results && (
                <>
                  <p role="status">
                    {t('Succeeded')}: {results.filter((result) => !result.error).length} · {t('Failed')}:{' '}
                    {results.filter((result) => result.error).length}
                  </p>
                  <div className="table-wrap">
                    <table className="data-table">
                      <tbody>
                        {results.map((result) => (
                          <tr key={result.item.id}>
                            <td>{result.item.model_name}</td>
                            <td>{result.error ? t(result.error) : t('Saved')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {results.some((result) => result.error) && (
                    <Button disabled={busy} onClick={() => execute(true)}>
                      {t('Retry failed records')}
                    </Button>
                  )}
                </>
              )}
              {deleted && (
                <p role="status">
                  {t('Deleted records')}: {deleted.deleted_count} · {t('Updated channels')}: {deleted.updated_channels}
                </p>
              )}
              {error && (
                <p role="alert" className="inline-error">
                  {t(error)}
                </p>
              )}
              <Button variant="outline" disabled={busy} onClick={() => setAction(null)}>
                {t('Close')}
              </Button>
            </DialogContent>
          </Dialog>
        )
      )}
    </>
  )
}
