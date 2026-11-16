'use client'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { homeFrameURL } from '@/lib/configured-content'
import { ConfiguredContentFrame } from './configured-content-frame'

/** Uses exactly the same server renderer as published documents and site content. */
export function ContentPreview(props: { source: string; allowFrameURL?: boolean; emptyMessage?: string }) {
  const { t } = useTranslation()
  const preview = useMutation({
    mutationFn: async (source: string) => {
      const url = props.allowFrameURL ? homeFrameURL(source) : null
      if (url) return { frame: url, html: '' }
      const response = await fetch('/content-preview', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: source })
      if (!response.ok) throw new Error('Preview failed')
      return (await response.json()) as { html: string; frame?: string }
    },
  })
  const current = preview.variables === props.source
  let content = (
    <p className="small-note">{props.emptyMessage ?? t('Refresh preview to view your current draft. Publishing is a separate action.')}</p>
  )
  if (preview.data && current)
    content = preview.data.frame ? (
      <ConfiguredContentFrame url={preview.data.frame} />
    ) : (
      <div className="site-rich-content" dangerouslySetInnerHTML={{ __html: preview.data.html }} />
    )
  return (
    <section className="content-preview">
      <div className="section-heading">
        <h3>{t('Preview')}</h3>
        <Button type="button" variant="outline" disabled={preview.isPending || !props.source} onClick={() => preview.mutate(props.source)}>
          {t(preview.isPending ? 'Loading...' : 'Refresh preview')}
        </Button>
      </div>
      {preview.isError && (
        <p role="alert" className="inline-error">
          {t('Preview failed')}
        </p>
      )}
      {content}
    </section>
  )
}
