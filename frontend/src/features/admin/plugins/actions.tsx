'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { PluginUsage } from './types'

export type PluginAction = {
  kind: 'status' | 'activate' | 'delete'
  key: string
  version?: string
  enabled?: boolean
  channels?: number
  inFlight?: number
}
export function PluginActionDialog(props: { action: PluginAction; onClose: () => void }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    action = props.action
  const [cascade, setCascade] = useState(false),
    [force, setForce] = useState(false),
    [usage, setUsage] = useState<PluginUsage | null>(null)
  const label = { status: action.enabled ? 'Enable plugin' : 'Disable plugin', activate: 'Activate version', delete: 'Delete version' }[action.kind]
  const mutation = useMutation({
    mutationFn: async () => {
      const base = `/api/plugin/task/${encodeURIComponent(action.key)}`
      if (action.kind === 'activate') return api(`${base}/activate`, { method: 'POST', body: { version: action.version } })
      if (action.kind === 'delete')
        return api(`${base}/versions/${encodeURIComponent(action.version!)}${force ? '?force=true' : ''}`, { method: 'DELETE' })
      return api(`${base}/status?${new URLSearchParams({ cascade: String(cascade), force: String(force) })}`, {
        method: 'POST',
        body: { enabled: action.enabled },
      })
    },
    onSuccess: () => {
      for (const key of [
        'task-plugins',
        'task-plugin-detail',
        'task-plugin-versions',
        'task-plugin-runtime',
        'task-plugin-options',
        'admin-channels',
        'ops-channels',
        'catalog',
      ])
        void queries.invalidateQueries({ queryKey: [key] })
      toast.success(t('Saved'))
      props.onClose()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.data && typeof error.data === 'object' && 'channels' in error.data && 'in_flight_count' in error.data)
        setUsage(error.data as PluginUsage)
    },
  })
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) props.onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(label)}</DialogTitle>
          <DialogDescription>
            {action.key}
            {action.version && ` @ ${action.version}`}
          </DialogDescription>
        </DialogHeader>
        {action.channels !== undefined && (
          <p>
            {t('Channels')}: {action.channels} · {t('In-flight tasks')}: {action.inFlight || 0}
          </p>
        )}
        {action.kind === 'activate' && (
          <p className="small-note">{t('The selected version will become active. Existing task routing must be reviewed before switching.')}</p>
        )}
        {action.kind === 'delete' && (
          <p className="small-note">{t('Only uploaded versions can be deleted. Deleting the active override may restore the built-in plugin.')}</p>
        )}
        {usage && (
          <div role="status">
            <p>{t('Plugin is still in use')}</p>
            <ul>
              {usage.channels.map((channel) => (
                <li key={channel.id}>
                  {channel.name} · #{channel.id}
                </li>
              ))}
            </ul>
            <p>
              {t('In-flight tasks')}: {usage.in_flight_count}
            </p>
          </div>
        )}
        {action.kind === 'status' && action.enabled === false && (
          <label className="checkbox-label">
            <input type="checkbox" checked={cascade} disabled={mutation.isPending} onChange={(event) => setCascade(event.target.checked)} />
            {t('Disable linked dedicated channels and remove this binding from gateway channels.')}
          </label>
        )}
        {(action.kind === 'delete' || (action.kind === 'status' && action.enabled === false)) && (
          <label className="checkbox-label">
            <input type="checkbox" checked={force} disabled={mutation.isPending} onChange={(event) => setForce(event.target.checked)} />
            {t('Force operation despite linked channels or in-flight tasks. Routing and results may be affected.')}
          </label>
        )}
        {mutation.error && (
          <p className="inline-error" role="alert">
            {t(mutation.error.message)}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="outline" disabled={mutation.isPending} onClick={props.onClose}>
            {t('Cancel')}
          </Button>
          <Button
            variant={action.kind === 'activate' || action.enabled ? 'default' : 'destructive'}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t(mutation.isPending ? 'Loading' : 'Confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
