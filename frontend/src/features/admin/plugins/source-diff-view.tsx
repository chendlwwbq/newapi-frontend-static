'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/shared/states'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import type { SourceDiffBlock } from './source-diff'

function DiffBlock(props: { block: SourceDiffBlock; first: boolean; last: boolean }) {
  const { t, i18n } = useTranslation(),
    [expanded, setExpanded] = useState(false),
    block = props.block
  const locale = toIntlLocale(i18n.language)
  let prefix = ' '
  if (block.kind === 'added') prefix = '+'
  if (block.kind === 'removed') prefix = '−'
  // First/last unchanged blocks show context nearest the change, not the file edge.
  const hiddenStart = props.first ? 0 : 3,
    hiddenEnd = props.last ? block.lines.length : block.lines.length - 3
  const canCollapse = block.kind === 'same' && !expanded && hiddenEnd - hiddenStart > 1
  return (
    <>
      {block.lines.map((line, index) => {
        if (canCollapse && index >= hiddenStart && index < hiddenEnd) {
          if (index !== hiddenStart) return null
          return (
            <div className="source-diff-fold" key={`fold-${index}`}>
              <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded(true)}>
                {t('Show {{lines}} unchanged lines', { lines: formatNumber(hiddenEnd - hiddenStart, locale) })}
              </Button>
            </div>
          )
        }
        return (
          <div className={`source-diff-line source-diff-${block.kind}`} key={index}>
            <span className="source-line-number">{block.kind !== 'added' && formatNumber(block.beforeLine + index, locale)}</span>
            <span className="source-line-number">{block.kind !== 'removed' && formatNumber(block.afterLine + index, locale)}</span>
            <span aria-hidden="true">{prefix}</span>
            <code>
              {line.replace(/\n$/, '')}
              {!line.endsWith('\n') && <span className="source-no-newline"> ↵ {t('No newline at end of file')}</span>}
            </code>
          </div>
        )
      })}
    </>
  )
}
export function SourceDiffView(props: { before: string; after: string }) {
  const { t, i18n } = useTranslation(),
    [result, setResult] = useState<{ blocks?: SourceDiffBlock[]; error?: boolean } | null>(null)
  useEffect(() => {
    setResult(null)
    if (props.before === props.after) return
    const worker = new Worker(new URL('./source-diff.worker.ts', import.meta.url))
    worker.onmessage = (event) => setResult(event.data)
    worker.onerror = () => setResult({ error: true })
    worker.postMessage({ before: props.before, after: props.after })
    return () => worker.terminate()
  }, [props.before, props.after])
  if (props.before === props.after)
    return (
      <p className="small-note" role="status">
        {t('No source changes')}
      </p>
    )
  if (!result) return <LoadingState />
  if (result.error || !result.blocks)
    return (
      <p role="alert" className="settings-inline-error">
        {t('Source comparison failed. Inspect the full source versions.')}
      </p>
    )
  const added = result.blocks.filter((block) => block.kind === 'added').reduce((sum, block) => sum + block.lines.length, 0),
    removed = result.blocks.filter((block) => block.kind === 'removed').reduce((sum, block) => sum + block.lines.length, 0)
  const locale = toIntlLocale(i18n.language)
  return (
    <section className="plugin-source-comparison">
      <p className="small-note" role="status">
        {t('Added lines')}: {formatNumber(added, locale)} · {t('Removed lines')}: {formatNumber(removed, locale)}
      </p>
      <div className="source-diff" aria-label={t('Source diff')} tabIndex={0}>
        {result.blocks.map((block, index) => (
          <DiffBlock key={index} block={block} first={index === 0} last={index === result.blocks!.length - 1} />
        ))}
      </div>
    </section>
  )
}
