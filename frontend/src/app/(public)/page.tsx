import { publicApi, publicModuleApi } from '@/lib/api/server'
import type { Catalog } from '@/lib/api/types'
import { HomePage } from '@/features/home/home-page'
import { SafeContent } from '@/components/shared/safe-content'
import { ConfiguredContentFrame } from '@/components/shared/configured-content-frame'
import { homeFrameURL } from '@/lib/configured-content'

export default async function Page() {
  const [catalog, stats, content, status] = await Promise.all([
    publicModuleApi<Catalog>('/api/catalog/models?currency=CNY'),
    publicApi<{ registered_users: number; online_users: number }>('/api/home/stats'),
    publicApi<string>('/api/home_page_content'),
    publicApi<{ faq_enabled: boolean; faq?: { id: number; question: string; answer: string }[] }>('/api/status'),
  ])
  const frame = homeFrameURL(content || '')
  let customContent
  if (content) customContent = frame ? <ConfiguredContentFrame url={frame} /> : <SafeContent source={content} />
  return <HomePage initialCatalog={catalog} stats={stats} faqEnabled={status.faq_enabled} faq={status.faq} customContent={customContent} />
}
