import { publicApi } from '@/lib/api/server'
import { DocumentationLibrary, type PublishedDocSummary } from '@/features/developer/published-documentation'

export const metadata = { title: 'Developer documentation' }

export default async function Page() {
  const docs = await publicApi<PublishedDocSummary[]>('/api/developer-docs/published')
  return <DocumentationLibrary docs={docs} />
}
