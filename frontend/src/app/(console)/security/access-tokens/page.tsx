import { AccessTokens } from '@/features/auth/access-tokens'
import { SecurityNav } from '@/features/auth/security-nav'
export default function Page() {
  return (
    <>
      <SecurityNav />
      <AccessTokens />
    </>
  )
}
