import { AccountBindings } from '@/features/auth/account-bindings'
import { SecurityNav } from '@/features/auth/security-nav'
export default function Page() {
  return (
    <>
      <SecurityNav />
      <AccountBindings />
    </>
  )
}
