'use client'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { PluginIcon } from './plugin-icon'
import { MAX_SOURCE_BYTES, fetchPluginText, validatePluginSource } from './transfer'
import type { PluginDetail, PluginUpload } from './types'

export function PluginUploadDialog(props: { initial?: PluginUpload; onClose: () => void; onSaved: (key: string) => void }) {
  const { t } = useTranslation(),
    queries = useQueryClient()
  const [source, setSource] = useState(props.initial?.source || ''),
    [remark, setRemark] = useState(props.initial?.remark || '')
  const [url, setUrl] = useState(''),
    [icon, setIcon] = useState(props.initial?.icon || ''),
    [reading, setReading] = useState(false),
    [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const mutation = useMutation({
    mutationFn: () =>
      api<PluginDetail>('/api/plugin/task', {
        method: 'POST',
        body: {
          source: validatePluginSource(source),
          remark,
          icon: icon || undefined,
          ...(source === props.initial?.source ? { sourceSha256: props.initial?.sourceSha256 } : {}),
        },
      }),
    onSuccess: (result) => {
      for (const key of ['task-plugins', 'task-plugin-detail', 'task-plugin-versions', 'task-plugin-runtime', 'task-plugin-options'])
        void queries.invalidateQueries({ queryKey: [key] })
      toast.success(t(result.plugin?.active === false ? 'Plugin saved, activation required' : 'Plugin uploaded successfully'))
      props.onSaved(result.meta.key)
    },
    onError: (error) => setError(error.message),
  })
  const busy = reading || mutation.isPending
  async function readSource(file: File) {
    setReading(true)
    try {
      if (file.size > MAX_SOURCE_BYTES) throw new Error('Plugin source exceeds the 8 MiB limit.')
      setSource(validatePluginSource(await file.text()))
      setError('')
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setReading(false)
    }
  }
  async function readIcon(file: File) {
    setReading(true)
    try {
      if (!/\.(svg|png)$/i.test(file.name)) throw new Error('Plugin icon must be SVG or PNG.')
      if (file.size > 512 * 1024) throw new Error('Plugin icon exceeds the 512 KiB limit.')
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
      setIcon(`data:${/\.svg$/i.test(file.name) ? 'image/svg+xml' : 'image/png'};base64,${btoa(binary)}`)
      setError('')
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setReading(false)
    }
  }
  async function loadUrl() {
    setReading(true)
    setError('')
    controller.current = new AbortController()
    try {
      setSource(await fetchPluginText(url, controller.current.signal))
    } catch (error) {
      if (!controller.current.signal.aborted) setError((error as Error).message)
    } finally {
      setReading(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) props.onClose()
      }}
    >
      <DialogContent className="admin-dialog plugin-dialog">
        <DialogHeader>
          <DialogTitle>{t('Upload plugin')}</DialogTitle>
          <DialogDescription>
            {t('Review the JavaScript source before saving. Compilation and routing validation run on the gateway.')}
          </DialogDescription>
        </DialogHeader>
        {props.initial?.marketplace && (
          <div className="console-panel plugin-market-review">
            <strong>
              {t('Marketplace selection')}:{' '}
              <code>
                {props.initial.marketplace.key}@{props.initial.marketplace.version}
              </code>
            </strong>
            <p className="small-note">{props.initial.marketplace.index}</p>
            <p className="small-note">{t('Saving a new version keeps the current active version. Activate it separately after review.')}</p>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setError('')
            mutation.mutate()
          }}
        >
          <fieldset className="plugin-form" disabled={busy}>
            <label className="field">
              {t('Source file')}
              <Input
                type="file"
                accept=".js,.mjs,text/javascript"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void readSource(file)
                }}
              />
            </label>
            <div className="plugin-url-row">
              <label className="field">
                {t('Source URL')}
                <Input value={url} onChange={(event) => setUrl(event.target.value)} type="url" />
              </label>
              <Button type="button" variant="outline" disabled={!url.trim()} onClick={loadUrl}>
                {t('Load source')}
              </Button>
            </div>
            <label className="field">
              {t('Plugin source')}
              <Textarea className="admin-pricing-expression" rows={13} required value={source} onChange={(event) => setSource(event.target.value)} />
            </label>
            {props.initial?.sourceSha256 && (
              <p className="small-note">
                SHA-256: <code>{props.initial.sourceSha256}</code> ·{' '}
                {t(
                  source === props.initial.source
                    ? 'Source hash will be verified by the gateway.'
                    : 'Source edited; marketplace hash no longer applies.'
                )}
              </p>
            )}
            <label className="field">
              {t('Remark')}
              <Input value={remark} onChange={(event) => setRemark(event.target.value)} />
            </label>
            <label className="field">
              {t('Plugin icon')}
              <Input
                type="file"
                accept=".svg,.png,image/svg+xml,image/png"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void readIcon(file)
                }}
              />
            </label>
            {icon && (
              <div className="plugin-identity">
                <PluginIcon pluginKey="upload-preview" iconSrc={icon} size={48} />
                <Button variant="outline" type="button" onClick={() => setIcon('')}>
                  {t('Clear icon')}
                </Button>
              </div>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {t(error)}
              </p>
            )}
            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={props.onClose}>
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={!source.trim()}>
                {t(busy ? 'Loading' : 'Save')}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
