import type { Metadata } from 'next'
import { ResetPasswordPage } from '@/features/auth/recovery-page'
export const metadata: Metadata = { title: 'Reset password', referrer: 'no-referrer', robots: { index: false, follow: false } }
export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string; token?: string }> }) {
  const { email = '', token = '' } = await searchParams
  return <ResetPasswordPage email={email} token={token} />
}
