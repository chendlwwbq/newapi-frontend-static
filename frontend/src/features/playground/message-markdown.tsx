'use client'

import { memo, useState } from 'react'
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
  return (
    <div className="chat-code-block">
      <div className="chat-code-toolbar">
        <CopyButton value={value} label={t('Copy code')} />
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

export const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, trust: false }]]}
        skipHtml
        components={{ pre: CodeBlock, img: MessageImage }}
      >
        {content}
      </Markdown>
    </div>
  )
})
