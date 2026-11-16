import { LoginPage } from '@/features/auth/login-page'
import { safeInternalPath } from '@/features/auth/console-return'

export default async function Page({ searchParams }: { searchParams: Promise<{ redirect?: string; returnTo?: string }> }) {
  const { redirect, returnTo } = await searchParams
  return <LoginPage returnTo={safeInternalPath(redirect || returnTo)} />
}
