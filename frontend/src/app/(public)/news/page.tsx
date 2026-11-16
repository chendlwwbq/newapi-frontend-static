import { publicApi } from '@/lib/api/server'
import { NewsPage, type NewsArticle } from '@/features/docs/news-page'
export const metadata = { title: 'News' }
export default async function Page() {
  const data = await publicApi<{ articles: NewsArticle[] }>('/api/news')
  return <NewsPage articles={data.articles} />
}
