import { publicApi } from '@/lib/api/server'
import { ContentPage } from '@/features/docs/content-page'
import { SafeContent } from '@/components/shared/safe-content'

export default async function Page() {
  const content = await publicApi<string>('/api/user-agreement')
  return (
    <ContentPage
      title="Terms of service"
      description="Platform usage guidelines, service boundaries and account responsibilities."
      fallbackDescription="Terms of service content has not been published by the site administrator yet."
      content={content}
    >
      <SafeContent source={content} />
    </ContentPage>
  )
}
