'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AdminConfirm } from './shared'
import { channelTagRequest, type ChannelTagChanges } from './lib/channel-operations'

const fields = {
  new_tag: 'New tag',
  priority: 'Priority',
  weight: 'Weight',
  models: 'Models',
  groups: 'Group',
  model_mapping: 'Model mapping',
  param_override: 'Parameter override',
  header_override: 'Header override',
} as const
export function ChannelTagEditor({ tag, sensitive, onClose }: { tag: string; sensitive: boolean; onClose: () => void }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [changes, setChanges] = useState<ChannelTagChanges>({}),
    [error, setError] = useState(''),
    [review, setReview] = useState<Record<string, string | number> | null>(null)
  const save = useMutation({
    mutationFn: (body: Record<string, string | number>) => api('/api/channel/tag', { method: 'PUT', body }),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['admin-channels'] })
      toast.success(t('Saved'))
      onClose()
    },
    onError: (error) => {
      setError(error.message)
      setReview(null)
    },
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      setReview(channelTagRequest(tag, changes, sensitive))
    } catch (error) {
      setError((error as Error).message)
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !save.isPending) onClose()
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>
              {t('Batch Edit by Tag')} · {tag}
            </DialogTitle>
          </DialogHeader>
          <p className="small-note">{t('Only checked fields are applied to every channel with this tag.')}</p>
          <form onSubmit={submit}>
            <div className="admin-form-grid">
              {Object.entries(fields)
                .filter(([key]) => sensitive || !['param_override', 'header_override'].includes(key))
                .map(([key, label]) => {
                  const name = key as keyof ChannelTagChanges,
                    selected = changes[name] !== undefined,
                    numeric = key === 'priority' || key === 'weight',
                    multiline = ['models', 'groups', 'model_mapping', 'param_override', 'header_override'].includes(key)
                  return (
                    <div className={multiline ? 'field admin-wide' : 'field'} key={key}>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) =>
                            setChanges((previous) => {
                              const next = { ...previous }
                              if (event.target.checked) next[name] = ''
                              else delete next[name]
                              return next
                            })
                          }
                        />
                        {t(label)}
                      </label>
                      {multiline ? (
                        <textarea
                          aria-label={t(label)}
                          rows={3}
                          disabled={!selected}
                          value={changes[name] || ''}
                          onChange={(event) => setChanges((previous) => ({ ...previous, [name]: event.target.value }))}
                        />
                      ) : (
                        <input
                          aria-label={t(label)}
                          type={numeric ? 'number' : 'text'}
                          min={key === 'weight' ? 0 : undefined}
                          step={numeric ? 1 : undefined}
                          disabled={!selected}
                          value={changes[name] || ''}
                          onChange={(event) => setChanges((previous) => ({ ...previous, [name]: event.target.value }))}
                        />
                      )}
                    </div>
                  )
                })}
            </div>
            {error && (
              <p role="alert" className="inline-error">
                {t(error)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {t('Review changes')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {review && (
        <AdminConfirm
          title={t('Batch Edit by Tag')}
          description={JSON.stringify(review, null, 2)}
          busy={save.isPending}
          onClose={() => setReview(null)}
          onConfirm={() => save.mutate(review)}
        />
      )}
    </>
  )
}
