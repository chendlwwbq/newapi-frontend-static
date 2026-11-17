import { publicApi } from '@/lib/api/server'
import { ContentPage } from '@/features/docs/content-page'
import { SafeContent } from '@/components/shared/safe-content'

export default async function Page() {
  const content = await publicApi<string>('/api/privacy-policy')
  return (
    <ContentPage
      title="Privacy policy"
      description="How account, API usage and billing data are processed and protected."
      fallbackDescription="Privacy policy content has not been published by the site administrator yet."
      content={content}
    >
      <SafeContent source={content} />
    </ContentPage>
  )
}
