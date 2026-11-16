import { OverviewPage } from '@/features/dashboard/overview-page'
import { publicApi } from '@/lib/api/server'
import { SafeContent } from '@/components/shared/safe-content'
export default async function Page() {
  const notice = await publicApi<string>('/api/notice')
  return <OverviewPage noticeContent={notice ? <SafeContent source={notice} /> : undefined} />
}
