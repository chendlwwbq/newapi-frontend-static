'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth/session'
import { ApiError } from '@/lib/api/client'
import { ErrorState } from '@/components/shared/states'

export function ModuleAccessError({ error, retry, returnTo }: { error: Error; retry: () => void; returnTo?: string }) {
  const { t } = useTranslation(),
    auth = useAuth(),
    path = usePathname()
  const signInRequired = error instanceof ApiError && error.status === 401 && !auth.bundle
  return (
    <>
      <ErrorState error={signInRequired ? new Error('Require login') : error} retry={retry} />
      {signInRequired && (
        <p className="module-sign-in">
          <Link className="pill-button" href={`/sign-in?redirect=${encodeURIComponent(returnTo || path)}`}>
            {t('Sign in')}
          </Link>
        </p>
      )}
    </>
  )
}
