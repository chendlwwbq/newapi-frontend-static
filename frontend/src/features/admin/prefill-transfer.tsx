'use client'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { PrefillGroup } from './prefill-groups-page'
import { parsePrefillImport, planPrefillImport, portablePrefill, type PrefillImportEntry } from './lib/prefill-transfer'
import { runMetadataBatch, type RecordResult } from './lib/metadata-batch'

export function PrefillTransfer({ exportGroups }: { exportGroups: PrefillGroup[] }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    request = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false),
    [text, setText] = useState(''),
    [replace, setReplace] = useState(false),
    [plan, setPlan] = useState<PrefillImportEntry[] | null>(null),
    [results, setResults] = useState<RecordResult<PrefillImportEntry>[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => () => request.current?.abort(), [])
  function download() {
    const blob = new Blob([JSON.stringify({ version: 1, groups: exportGroups.map(portablePrefill) }, null, 2)], {
        type: 'application/json;charset=utf-8',
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement('a')
    link.href = url
    link.download = 'eva-prefill-groups.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  async function file(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    try {
      setText(await selected.text())
      setError('')
    } catch (failure) {
      setError((failure as Error).message)
    }
  }
  async function preview() {
    setBusy(true)
    setError('')
    try {
      const groups = parsePrefillImport(text),
        current = await api<PrefillGroup[]>('/api/prefill_group')
      setPlan(planPrefillImport(groups, current, replace))
      setResults(null)
    } catch (failure) {
      setError(failure instanceof SyntaxError ? 'Invalid JSON object' : (failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function apply(retry = false) {
    if (!plan) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const current = await api<PrefillGroup[]>('/api/prefill_group', { signal: controller.signal }),
        byName = new Map(current.map((group) => [group.name, group]))
      const pending = retry ? results!.filter((result) => result.error).map((result) => result.item) : plan.filter((entry) => entry.action !== 'skip')
      const next = await runMetadataBatch(
        pending,
        (entry) => {
          const stored = byName.get(entry.group.name)
          if (
            (entry.action === 'create' && stored) ||
            (entry.action === 'update' &&
              (!stored ||
                stored.id !== entry.existing?.id ||
                JSON.stringify(portablePrefill(stored)) !== JSON.stringify(portablePrefill(entry.existing!))))
          )
            throw new Error('Prefill group changed. Preview again before importing.')
          return api('/api/prefill_group', {
            method: entry.action === 'create' ? 'POST' : 'PUT',
            body: { ...(entry.action === 'update' ? entry.existing : {}), ...entry.group },
            signal: controller.signal,
          })
        },
        controller.signal
      )
      if (controller.signal.aborted) return
      setResults((previous) => [...(retry ? previous!.filter((result) => !result.error) : []), ...next])
      void queries.invalidateQueries({ queryKey: ['prefill-groups'] })
    } catch (failure) {
      if (!controller.signal.aborted) setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button variant="outline" disabled={!exportGroups.length} onClick={download}>
        {t('Export filtered groups')}
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true)
          setPlan(null)
          setResults(null)
          setError('')
        }}
      >
        {t('Import groups')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value)
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Import groups')}</DialogTitle>
            <DialogDescription>{t('Import JSON locally, review duplicate names, then save the selected changes.')}</DialogDescription>
          </DialogHeader>
          {!plan && (
            <fieldset className="admin-pricing-fields" disabled={busy}>
              <label className="field">
                {t('JSON file')}
                <input type="file" accept=".json,application/json" onChange={file} />
              </label>
              <label className="field">
                JSON
                <textarea
                  rows={9}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={'{"version":1,"groups":[{"name":"Example","type":"model","items":["gpt-4o-mini"]}]}'}
                />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
                {t('Replace groups with matching names')}
              </label>
              <p className="small-note">{t('Existing names are skipped by default. Export includes only the filtered groups.')}</p>
              <Button disabled={!text.trim()} onClick={preview}>
                {t('Preview')}
              </Button>
            </fieldset>
          )}
          {plan && (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('Name')}</th>
                      <th>{t('Type')}</th>
                      <th>{t('Action')}</th>
                      <th>{t('Changes')}</th>
                      <th>{t('Result')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.map((entry) => {
                      const result = results?.find((result) => result.item === entry)
                      return (
                        <tr key={entry.group.name}>
                          <td>{entry.group.name}</td>
                          <td>{t(entry.group.type === 'model' ? 'Models' : entry.group.type === 'tag' ? 'Tags' : 'Endpoints')}</td>
                          <td>{t(entry.action === 'create' ? 'Create' : entry.action === 'update' ? 'Replace' : 'Skip')}</td>
                          <td>
                            <details>
                              <summary>{t('Details')}</summary>
                              <pre className="admin-pricing-effective">
                                {JSON.stringify({ before: entry.existing ? portablePrefill(entry.existing) : null, after: entry.group }, null, 2)}
                              </pre>
                            </details>
                          </td>
                          <td>{entry.action === 'skip' ? t('Skipped') : result ? (result.error ? t(result.error) : t('Saved')) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {results && (
                <p role="status">
                  {t('Succeeded')}: {results.filter((result) => !result.error).length} · {t('Failed')}:{' '}
                  {results.filter((result) => result.error).length} · {t('Skipped')}: {plan.filter((entry) => entry.action === 'skip').length}
                </p>
              )}
              {!results ? (
                <Button disabled={busy || plan.every((entry) => entry.action === 'skip')} onClick={() => apply()}>
                  {t(busy ? 'Loading' : 'Apply changes')}
                </Button>
              ) : (
                results.some((result) => result.error) && (
                  <Button disabled={busy} onClick={() => apply(true)}>
                    {t('Retry failed records')}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setPlan(null)
                  setResults(null)
                }}
              >
                {t('Back')}
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {t(error)}
            </p>
          )}
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            {t('Close')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
