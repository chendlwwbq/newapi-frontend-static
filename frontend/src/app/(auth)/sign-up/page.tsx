import { RegisterPage } from '@/features/auth/register-page'
import { safeInternalPath } from '@/features/auth/console-return'

export default async function Page({ searchParams }: { searchParams: Promise<{ aff?: string; redirect?: string; returnTo?: string }> }) {
  const { aff, redirect, returnTo } = await searchParams
  return <RegisterPage affiliate={aff} returnTo={safeInternalPath(redirect || returnTo)} />
}
