'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { formatNumber, useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { logTypeLabels } from './contracts'
import { downloadCsv, exportLogs, getLogCsvHeader, getLogCsvRow, toCsvLine } from './export'

export function LogExportDialog(props: { params: string; admin: boolean; maxRangeDays: number; onClose: () => void }) {
  const { t, i18n } = useTranslation(),
    locale = toIntlLocale(i18n.language),
    format = useQuotaFormatter()
  const [busy, setBusy] = useState(false),
    [count, setCount] = useState(0),
    [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const params = new URLSearchParams(props.params)
  const start = Number(params.get('start_timestamp'))
  const end = Number(params.get('end_timestamp'))
  const rangeExceeded =
    props.maxRangeDays > 0 && start > 0 && Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start > props.maxRangeDays * 86400
  const rangeError = rangeExceeded ? t('The time range cannot exceed {{days}} days', { days: props.maxRangeDays }) : ''
  async function download() {
    if (rangeError) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setError('')
    setCount(0)
    const lines = [toCsvLine(getLogCsvHeader(props.admin, t))]
    let seen = 0
    try {
      const total = await exportLogs(new URLSearchParams(props.params), props.admin, {
        signal: abort.signal,
        onLog: (log) => {
          lines.push(
            toCsvLine(
              getLogCsvRow(
                log,
                props.admin,
                t,
                (value) => format(value, { abbreviate: false }),
                (value) => new Date(value * 1000).toLocaleString(locale, { hour12: false })
              )
            )
          )
          seen++
          if (seen === 1 || seen % 100 === 0) setCount(seen)
        },
      })
      setCount(total)
      downloadCsv(`eva-logs-${new Date().toISOString().slice(0, 10)}.csv`, lines)
    } catch (error) {
      if (!abort.signal.aborted) setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const labels: Record<string, string> = {
    type: 'Type',
    start_timestamp: 'Start time',
    end_timestamp: 'End time',
    model_name: 'Model',
    token_name: 'Token',
    group: 'Group',
    username: 'User',
    channel: 'Channel',
    request_id: 'Request ID',
    upstream_request_id: 'Upstream Request ID',
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className="log-dialog">
        <DialogHeader>
          <DialogTitle>{t('Export logs')}</DialogTitle>
          <DialogDescription>{t('Export every matching record in the applied filters, beyond the current page.')}</DialogDescription>
        </DialogHeader>
        <dl className="ops-details">
          <div>
            <dt>{t('Scope')}</dt>
            <dd>{t(props.admin ? 'All users' : 'My logs')}</dd>
          </div>
          {[...params].map(([key, value]) => {
            let text = value
            if (key === 'type') text = t(Number(value) === 0 ? 'All types' : logTypeLabels[Number(value)] || 'Unknown')
            else if (key.endsWith('_timestamp')) text = new Date(Number(value) * 1000).toLocaleString(locale, { hour12: false })
            return (
              <div key={key}>
                <dt>{t(labels[key] || key)}</dt>
                <dd>{text}</dd>
              </div>
            )
          })}
        </dl>
        <p className="small-note">
          {t('Records received')}: {formatNumber(count, locale)}
        </p>
        {rangeError && (
          <p role="alert" className="inline-error">
            {rangeError}
          </p>
        )}
        {error && (
          <p role="alert" className="inline-error">
            {t(error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>
            {t(busy ? 'Cancel' : 'Close')}
          </Button>
          <Button disabled={busy || !!rangeError} onClick={download}>
            {t(busy ? 'Exporting...' : 'Download CSV')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
