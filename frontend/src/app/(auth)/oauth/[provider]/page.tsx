import type { Metadata } from 'next'
import { OAuthCallbackPage } from '@/features/auth/oauth-callback-page'

export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>
  searchParams: Promise<{
    state?: string
    code?: string
    error?: string
    error_description?: string
  }>
}) {
  const [{ provider }, query] = await Promise.all([params, searchParams])
  return (
    <OAuthCallbackPage
      provider={provider}
      state={query.state || ''}
      code={query.code}
      error={query.error}
      errorDescription={query.error_description}
    />
  )
}
