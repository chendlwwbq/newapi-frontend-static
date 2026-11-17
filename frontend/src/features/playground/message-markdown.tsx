'use client'

import { memo, useState, type ComponentProps } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/shared/copy-button'
import { Button } from '@/components/ui/button'
import { imageUrl } from './lib/image-messages'
import 'katex/dist/katex.min.css'

const CodeBlock: NonNullable<Components['pre']> = ({ node, children }) => {
  const { t } = useTranslation()
  const code = node?.children.find((child) => child.type === 'element' && child.tagName === 'code')
  const value = code?.type === 'element' ? code.children.map((child) => (child.type === 'text' ? child.value : '')).join('') : ''
  const classes = code?.type === 'element' && Array.isArray(code.properties?.className) ? code.properties.className : []
  const langClass = classes.find((item): item is string => typeof item === 'string' && item.startsWith('language-'))
  const language = langClass ? langClass.slice('language-'.length) : 'code'
  return (
    <div className="chat-code-block">
      <div className="chat-code-toolbar sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-900/95 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-sm">
        <span className="font-mono text-xs lowercase tracking-wide text-zinc-400">{language}</span>
        <CopyButton value={value} label={t('Copy code')} className="text-zinc-300 hover:bg-white/10 hover:text-white" />
      </div>
      <pre>{children}</pre>
    </div>
  )
}

const MessageImage: NonNullable<Components['img']> = ({ src, alt }) => {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const url = typeof src === 'string' ? imageUrl(src) : null
  if (!url) return <span>{alt}</span>
  return (
    <span className="chat-markdown-image">
      <Button type="button" variant="outline" size="sm" onClick={() => setVisible((value) => !value)} aria-expanded={visible}>
        {t(visible ? 'Hide' : 'Show')} {t('Image')}
        {alt ? ` · ${alt}` : ''}
      </Button>
      {visible && <img src={url} alt={alt || ''} referrerPolicy="no-referrer" loading="lazy" />}
    </span>
  )
}

const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS: NonNullable<ComponentProps<typeof Markdown>['rehypePlugins']> = [[rehypeKatex, { throwOnError: false, trust: false }]]
const MARKDOWN_COMPONENTS: Components = { pre: CodeBlock, img: MessageImage }

export const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} skipHtml components={MARKDOWN_COMPONENTS}>
        {content}
      </Markdown>
    </div>
  )
})
