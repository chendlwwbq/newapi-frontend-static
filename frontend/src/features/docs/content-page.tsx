'use client'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/shared/states'
import type { ReactNode } from 'react'

export function ContentPage({ title, content, children }: { title: string; content: string; children?: ReactNode }) {
  const { t } = useTranslation()

  return (
    <main className="page-container" id="content">
      <article className="docs-article mx-auto max-w-3xl">
        <h1>{t(title)}</h1>
        {content ? <div className="mt-8 space-y-4 leading-7 text-foreground/90">{children || content}</div> : <EmptyState />}
      </article>
    </main>
  )
}
