import { notFound } from 'next/navigation'
import { publicOptionalApi } from '@/lib/api/server'
import { SafeContent } from '@/components/shared/safe-content'
import { PublishedDocumentation } from '@/features/developer/published-documentation'
import { videoRouteSelection } from '@/features/docs/guides'
import type { DeveloperDoc } from '@/features/developer/types'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = await publicOptionalApi<DeveloperDoc>(`/api/developer-docs/published/${encodeURIComponent(slug)}`)
  if (!doc) notFound()
  const { markdown_content, bindings, ...summary } = doc
  void bindings
  const notice = slug === 'video-generation-api' ? videoRouteSelection : undefined
  return (
    <PublishedDocumentation doc={summary} notice={notice}>
      {doc.source_type === 'markdown' && <SafeContent source={markdown_content} />}
    </PublishedDocumentation>
  )
}
