import { DocsHub } from '@/features/docs/docs-hub'
import { DocsAll } from '@/features/docs/docs-all'
import { DocsPage } from '@/features/docs/docs-page'
import { notFound, redirect } from 'next/navigation'
import { guides, toolNames } from '@/features/docs/guides'
import { publicOptionalApi } from '@/lib/api/server'

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  if (!slug?.length) return <DocsHub />
  const id = slug.join('/')
  if (id === 'all') return <DocsAll />
  if (id === 'video-generation' && (await publicOptionalApi('/api/developer-docs/published/video-generation-api')))
    redirect('/docs/published/video-generation-api')
  if (!Object.hasOwn(guides, id) && !Object.hasOwn(toolNames, id)) notFound()
  return <DocsPage slug={id} />
}
