import { notFound } from 'next/navigation'
import { publicOptionalApi } from '@/lib/api/server'
import { SafeContent } from '@/components/shared/safe-content'
import { NewsPage, type NewsArticle } from '@/features/docs/news-page'
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await publicOptionalApi<NewsArticle>(`/api/news/${encodeURIComponent(slug)}`)
  if (!article) notFound()
  const { body, ...summary } = article
  return (
    <NewsPage article={summary}>
      <SafeContent source={body || ''} />
    </NewsPage>
  )
}
