import { LoginPage } from '@/features/auth/login-page'

export default async function Page({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect } = await searchParams
  return <LoginPage returnTo={redirect} />
}
