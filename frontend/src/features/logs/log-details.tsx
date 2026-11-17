'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UsageLog } from '@/lib/api/types'
import { formatNumber, useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/copy-button'
import { AffinityUsage } from '@/features/admin/affinity-cache'
import { logAffinity, logOther, logTypeLabels } from './contracts'

export function LogDetails(props: { log: UsageLog; admin: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation(),
    format = useQuotaFormatter(),
    locale = toIntlLocale(i18n.language),
    [affinity, setAffinity] = useState(false)
  const log = props.log,
    other = logOther(log),
    target = props.admin ? logAffinity(log) : null
  const rows: [string, unknown][] = [
    ['Time', new Date(log.created_at * 1000).toLocaleString(locale, { hour12: false })],
    ['Type', t(logTypeLabels[log.type] || 'Unknown')],
    ['Model', log.model_name],
    ['Token', log.token_name],
    ['Group', log.group],
    ['Cost', format(log.quota, { abbreviate: false })],
    ['Input Tokens', formatNumber(log.prompt_tokens, locale)],
    ['Output Tokens', formatNumber(log.completion_tokens, locale)],
    ['Duration', `${formatNumber(log.use_time, locale)}s`],
    ['Stream', t(log.is_stream ? 'Yes' : 'No')],
    ['IP', log.ip],
    ['Request ID', log.request_id],
    ['Upstream Request ID', log.upstream_request_id],
  ]
  if (props.admin) rows.push(['User', log.username], ['Channel', log.channel_name || log.channel])
  for (const [key, label] of Object.entries({
    cache_tokens: 'Cache Read',
    cache_creation_tokens: 'Cache Write',
    cache_creation_tokens_5m: 'Cache Write (5m)',
    cache_creation_tokens_1h: 'Cache Write (1h)',
  }))
    if (typeof other[key] === 'number') rows.push([label, formatNumber(other[key], locale)])
  if (typeof other.frt === 'number' && other.frt > 0) rows.push(['First response time (ms)', formatNumber(other.frt, locale)])
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className="log-dialog flex max-h-[88vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {t('Details')} #{log.id}
          </DialogTitle>
          <DialogDescription>{log.model_name || t('Usage logs')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <dl className="ops-details">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{t(label)}</dt>
                <dd>
                  {value === undefined || value === '' ? '—' : String(value)}
                  {['Request ID', 'Upstream Request ID'].includes(label) && !!value && <CopyButton value={String(value)} />}
                </dd>
              </div>
            ))}
          </dl>
          {log.content && (
            <section>
              <h3>{t('Content')}</h3>
              <pre className="log-json rounded-xl border border-white/10 bg-zinc-950/95 p-3 font-mono text-xs text-zinc-100 shadow-inner overflow-x-auto">
                {log.content}
              </pre>
            </section>
          )}
          {target && (
            <>
              <Button variant="outline" onClick={() => setAffinity(!affinity)} aria-expanded={affinity}>
                {t('Channel Affinity: Upstream Cache Hit')}
              </Button>
              {affinity && <AffinityUsage target={target} />}
            </>
          )}
          {log.other && (
            <details>
              <summary>{t('Additional data')}</summary>
              <pre className="log-json rounded-xl border border-white/10 bg-zinc-950/95 p-3 font-mono text-xs text-zinc-100 shadow-inner overflow-x-auto">
                {Object.keys(other).length ? JSON.stringify(other, null, 2) : log.other}
              </pre>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
