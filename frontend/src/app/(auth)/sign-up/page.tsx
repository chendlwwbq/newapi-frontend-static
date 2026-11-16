import { RegisterPage } from '@/features/auth/register-page'
export default async function Page({ searchParams }: { searchParams: Promise<{ aff?: string }> }) {
  const { aff } = await searchParams
  return <RegisterPage affiliate={aff} />
}
