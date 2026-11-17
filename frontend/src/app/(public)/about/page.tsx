import { publicApi } from '@/lib/api/server'
import { ContentPage } from '@/features/docs/content-page'
import { SafeContent } from '@/components/shared/safe-content'

export default async function Page() {
  const content = await publicApi<string>('/api/about')
  return (
    <ContentPage
      title="About"
      description="Platform overview, gateway architecture and service information."
      fallbackDescription="About page content has not been customized by the site administrator yet."
      content={content}
    >
      <SafeContent source={content} />
    </ContentPage>
  )
}
