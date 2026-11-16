import { PublicHeader, PublicFooter, SupportDock } from '@/components/layout/public-shell'
import { publicApi } from '@/lib/api/server'
import { SafeContent } from '@/components/shared/safe-content'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const status = await publicApi<{ footer_html: string }>('/api/status')
  return (
    <>
      <a className="skip-link" href="#content">
        跳到正文
      </a>
      <PublicHeader />
      {children}
      <PublicFooter>{status.footer_html && <SafeContent source={status.footer_html} />}</PublicFooter>
      <SupportDock />
    </>
  )
}
