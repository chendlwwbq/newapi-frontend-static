'use client'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import type { SystemInstance } from './ops-types'

export function InstanceDetails({
  instance,
  date,
  bytes,
  percent,
  onClose,
}: {
  instance: SystemInstance
  date: (value?: number) => string
  bytes: (value?: number) => string
  percent: (value?: number) => string
  onClose: () => void
}) {
  const { t } = useTranslation(),
    info = instance.info
  let role = '—'
  if (info?.role?.is_master !== undefined) role = t(info.role.is_master ? 'Master' : 'Worker')
  const rows: [string, unknown][] = [
    ['Instance', instance.node_name],
    ['Status', t(instance.status === 'online' ? 'Online' : 'Stale')],
    ['Role', role],
    ['Node name source', info?.node?.source],
    ['Hostname', info?.host?.hostname],
    ['Version', info?.runtime?.version],
    ['Operating system', info?.runtime?.goos],
    ['Architecture', info?.runtime?.goarch],
    ['Started at', date(instance.started_at || info?.runtime?.started_at)],
    ['Last seen', date(instance.last_seen_at)],
    ['Stale after (seconds)', instance.stale_after_seconds],
    ['CPU', percent(info?.resources?.cpu?.usage_percent)],
    ['Memory', percent(info?.resources?.memory?.usage_percent)],
    ['Total disk space', bytes(info?.resources?.storage?.total_bytes)],
    ['Used disk space', bytes(info?.resources?.storage?.used_bytes)],
    ['Free disk space', bytes(info?.resources?.storage?.free_bytes)],
    ['Disk usage', percent(info?.resources?.storage?.used_percent)],
  ]
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="instance-dialog">
        <DialogHeader>
          <DialogTitle>{t('Instance details')}</DialogTitle>
          <DialogDescription>{instance.node_name}</DialogDescription>
        </DialogHeader>
        {info?.node?.should_configure_manually && (
          <p className="inline-notice">
            {t('This instance is using an automatic hostname. Set NODE_NAME to a stable unique value for multi-instance management.')}
          </p>
        )}
        <dl className="ops-details">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{t(label)}</dt>
              <dd>
                {value === undefined || value === '' ? '—' : String(value)}
                {label === 'Instance' && <CopyButton value={instance.node_name} />}
              </dd>
            </div>
          ))}
        </dl>
        <p className="small-note">{t('Master instances run scheduled tasks. Worker instances do not run master-only tasks.')}</p>
        {info && (
          <details>
            <summary>{t('Additional data')}</summary>
            <pre className="log-json">{JSON.stringify(info, null, 2)}</pre>
          </details>
        )}
      </DialogContent>
    </Dialog>
  )
}
