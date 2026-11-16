'use client'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/shared/states'
import type { ReactNode } from 'react'

export function ContentPage({ title, content, children }: { title: string; content: string; children?: ReactNode }) {
  const { t } = useTranslation()

  return (
    <main className="page-container" id="content">
      <article className="docs-article" style={{ maxWidth: 800, margin: 'auto' }}>
        <h1>{t(title)}</h1>
        {content ? <div style={{ lineHeight: 2, marginTop: 35 }}>{children || content}</div> : <EmptyState />}
      </article>
    </main>
  )
}
