'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { api } from '@/lib/api/client'
import { freshAuthHeaders } from '@/lib/auth/session'

export function FaceProcessingTool() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>{t('Face processing')}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Face processing')}</DialogTitle>
          <DialogDescription>{t('Process a reference image locally, preview it, then download it for video generation.')}</DialogDescription>
        </DialogHeader>
        {open && <FaceProcessingPanel />}
      </DialogContent>
    </Dialog>
  )
}

export function FaceProcessingPanel() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [original, setOriginal] = useState('')
  const [result, setResult] = useState<{ url: string; changed: boolean } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const operation = useRef<AbortController | null>(null)
  const config = useQuery({
    queryKey: ['face-processing-config'],
    queryFn: () => api<{ enabled: boolean; max_bytes: number }>('/api/playground/uploads/face-processing/config'),
    retry: false,
  })
  useEffect(() => {
    if (!file) {
      setOriginal('')
      return
    }
    const url = URL.createObjectURL(file)
    setOriginal(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url)
    },
    [result]
  )
  useEffect(() => () => operation.current?.abort(), [])

  async function processImage() {
    if (!file || busy || !config.data?.enabled) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/playground/uploads/face-processing?method=grid', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: { ...(await freshAuthHeaders()), 'Content-Type': file.type },
        body: file,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message_key || body?.message || 'Face processing failed')
      }
      if (!response.headers.get('Content-Type')?.startsWith('image/jpeg')) throw new Error('Face processing failed')
      const blob = await response.blob()
      const stats = JSON.parse(response.headers.get('X-Face-Stats') || '{}') as { action?: string }
      if (!controller.signal.aborted) setResult({ url: URL.createObjectURL(blob), changed: stats.action === 'processed' })
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause : new Error('Face processing failed'))
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  if (config.isPending) return <LoadingState />
  if (config.error) return <ErrorState error={config.error} retry={() => void config.refetch()} />
  if (!config.data?.enabled) return <p role="status">{t('Face processing is unavailable')}</p>
  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        <span>{t('Reference image')}</span>
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const next = event.target.files?.[0]
            setResult(null)
            setError(null)
            setFile(null)
            if (!next) return
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || !next.size) {
              setError(new Error('Select a valid JPEG, PNG or WebP image'))
            } else if (next.size > config.data.max_bytes) {
              setError(new Error('Face image must be at most 10 MB'))
            } else setFile(next)
          }}
        />
      </label>
      <p className="text-sm text-muted-foreground">{t('YuNet detects faces and applies a diamond grid while preserving image dimensions.')}</p>
      <Button disabled={!file || busy} onClick={() => void processImage()}>
        {busy ? t('Processing image…') : t('Process image')}
      </Button>
      {error && <ErrorState error={error} />}
      <div className="grid gap-4 sm:grid-cols-2" aria-busy={busy}>
        {original && (
          <figure>
            <figcaption>{t('Original image')}</figcaption>
            <img className="max-h-72 w-full object-contain" src={original} alt={t('Original image')} />
          </figure>
        )}
        {result && (
          <figure>
            <figcaption>{t('Processed image')}</figcaption>
            <img className="max-h-72 w-full object-contain" src={result.url} alt={t('Processed image')} />
          </figure>
        )}
      </div>
      {result && (
        <div className="grid gap-2" role="status">
          <p>{result.changed ? t('Image processing complete') : t('No face was changed; review the preview before use.')}</p>
          <a className="text-link" href={result.url} download="face-grid.jpg">
            {t('Download processed image')}
          </a>
        </div>
      )}
    </div>
  )
}
