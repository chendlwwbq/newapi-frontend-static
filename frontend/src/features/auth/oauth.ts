'use client'
import { api } from '@/lib/api/client'
import { buildOAuthAuthorizationUrl } from '@/lib/oauth'
import type { SystemStatus } from './types'
import type { VerificationOperation } from './secure-verification/types'

export async function createOAuthAuthorization(
  provider: string,
  intent: 'login' | 'verify' | 'bind',
  status: SystemStatus,
  signal?: AbortSignal,
  operation?: VerificationOperation,
  proof?: string
) {
  const result = await api<string | { flow_token: string; authorization_url?: string }>('/api/oauth/state', {
    method: 'POST',
    anonymous: intent === 'login',
    signal,
    headers: proof ? { 'X-Security-Proof': proof } : undefined,
    body: { provider, intent, ...(operation ? { scope: operation.scope, context: operation.context } : {}) },
  })
  const state = typeof result === 'string' ? result : result.flow_token
  return { state, url: (typeof result === 'object' && result.authorization_url) || buildOAuthAuthorizationUrl(provider, state, status) }
}

export function availableOAuthProviders(status: SystemStatus) {
  return [
    ...(status.telegram_oauth ? [{ slug: 'telegram', name: 'Telegram' }] : []),
    ...(status.github_oauth ? [{ slug: 'github', name: 'GitHub' }] : []),
    ...(status.discord_oauth ? [{ slug: 'discord', name: 'Discord' }] : []),
    ...(status.oidc_enabled ? [{ slug: 'oidc', name: status.oidc_display_name || 'OIDC' }] : []),
    ...(status.linuxdo_oauth ? [{ slug: 'linuxdo', name: 'LinuxDO' }] : []),
    ...(status.custom_oauth_providers || []).map(({ slug, name }) => ({ slug, name })),
  ]
}
