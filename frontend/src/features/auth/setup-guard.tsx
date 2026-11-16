'use client'
import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LoadingState } from '@/components/shared/states'
import { useAuthStatus } from './use-auth-status'
export function SetupGuard({ children }: { children: ReactNode }) {
  const status = useAuthStatus(),
    path = usePathname(),
    router = useRouter()
  const needsSetup = status.data?.setup === false && path !== '/setup'
  useEffect(() => {
    if (needsSetup) router.replace('/setup')
  }, [needsSetup, router])
  return needsSetup ? <LoadingState /> : children
}
