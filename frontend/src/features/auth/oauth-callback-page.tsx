'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { acceptSession } from '@/lib/auth/session'
import type { AuthBundle, Challenge } from '@/lib/api/types'
import { OAUTH_POPUP_CALLBACK_MESSAGE, OAUTH_POPUP_RESULT_MESSAGE } from './constants'
import { consumeOAuthLoginRedirect, getOAuthSessionStorage, resolveOAuthCallbackMode, type OAuthCallbackMode } from './lib/oauth-callback-mode'
import { AuthShell } from './auth-shell'
import { LoginPage } from './login-page'

export function OAuthCallbackPage({
  provider,
  state,
  code,
  error,
  errorDescription,
}: {
  provider: string
  state: string
  code?: string
  error?: string
  errorDescription?: string
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient()
  const mode = useRef<OAuthCallbackMode | null>(null),
    exchange = useRef<Promise<AuthBundle | Challenge> | null>(null)
  const [failure, setFailure] = useState(''),
    [challenge, setChallenge] = useState<Challenge | null>(null),
    [returnTo, setReturnTo] = useState('/dashboard/overview')
  useEffect(() => {
    let active = true
    mode.current ??= resolveOAuthCallbackMode(provider, state, { opener: window.opener, storage: getOAuthSessionStorage(window) })
    if (mode.current !== 'login') {
      const intent = mode.current,
        opener = window.opener
      const receive = (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin ||
          event.source !== opener ||
          event.data?.type !== OAUTH_POPUP_RESULT_MESSAGE ||
          event.data.provider !== provider ||
          event.data.state !== state ||
          event.data.intent !== intent
        )
          return
        if (event.data.success) window.close()
        else setFailure(event.data.message || 'OAuth verification failed')
      }
      window.addEventListener('message', receive)
      opener.postMessage({ type: OAUTH_POPUP_CALLBACK_MESSAGE, intent, provider, state, code, error, errorDescription }, window.location.origin)
      return () => window.removeEventListener('message', receive)
    }
    if (!state || (!code && !error)) {
      setFailure('Invalid OAuth callback')
      return
    }
    // A callback consumes its server-side state once, including under Strict Mode.
    exchange.current ??= api<AuthBundle | Challenge>(
      `/api/oauth/${encodeURIComponent(provider)}?${new URLSearchParams({ state, ...(code ? { code } : {}), ...(error ? { error } : {}), ...(errorDescription ? { error_description: errorDescription } : {}) })}`,
      { anonymous: true }
    )
    void exchange.current
      .then((result) => {
        if (!active) return
        const redirect = consumeOAuthLoginRedirect(state) || '/dashboard/overview'
        const safe = redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('\\') ? redirect : '/dashboard/overview'
        if ('require_verification' in result) {
          setReturnTo(safe)
          setChallenge(result)
        } else {
          queries.clear()
          acceptSession(result)
          router.replace(safe)
        }
      })
      .catch((err) => {
        if (active) setFailure((err as Error).message)
      })
    return () => {
      active = false
    }
  }, [provider, state, code, error, errorDescription, queries, router])
  if (challenge) return <LoginPage initialChallenge={challenge} returnTo={returnTo} />
  return (
    <AuthShell>
      <h1>{provider}</h1>
      <p role={failure ? 'alert' : 'status'} className={failure ? 'inline-error' : undefined}>
        {t(failure || 'Processing OAuth response...')}
      </p>
      <p className="auth-switch">
        <Link href="/sign-in">{t('Back to sign in')}</Link>
      </p>
    </AuthShell>
  )
}
