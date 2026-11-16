'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { CustomOAuthBinding } from '@/lib/oauth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { SecurityDialog } from '@/features/auth/secure-verification/security-dialog'
import type { VerificationOperation } from '@/features/auth/secure-verification/types'
import { useAuthStatus } from '@/features/auth/use-auth-status'
import type { AdminUser } from './types'

type BindingUser = AdminUser & {
  github_id?: string
  discord_id?: string
  wechat_id?: string
  oidc_id?: string
  telegram_id?: string
  linux_do_id?: string
}
interface Binding {
  key: string
  label: string
  value: string
  enabled: boolean
  providerId?: number
}

export function UserBindings({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    status = useAuthStatus()
  const query = useQuery({
    queryKey: ['admin-user-bindings', bundle?.user.id, user.id],
    queryFn: async ({ signal }) => {
      const [detail, bindings] = await Promise.all([
        api<BindingUser>(`/api/user/${user.id}`, { signal }),
        api<CustomOAuthBinding[]>(`/api/user/${user.id}/oauth/bindings`, { signal }),
      ])
      return { detail, bindings }
    },
  })
  const [boundOnly, setBoundOnly] = useState(true),
    [reveal, setReveal] = useState(false),
    [pending, setPending] = useState<Binding | null>(null)
  const detail = query.data?.detail
  const builtins: Binding[] = [
    { key: 'email', label: 'Email', value: detail?.email || '', enabled: true },
    { key: 'github', label: 'GitHub', value: detail?.github_id || '', enabled: !!status.data?.github_oauth },
    { key: 'discord', label: 'Discord', value: detail?.discord_id || '', enabled: !!status.data?.discord_oauth },
    { key: 'wechat', label: 'WeChat', value: detail?.wechat_id || '', enabled: !!status.data?.wechat_login },
    { key: 'oidc', label: status.data?.oidc_display_name || 'OIDC', value: detail?.oidc_id || '', enabled: !!status.data?.oidc_enabled },
    { key: 'telegram', label: 'Telegram', value: detail?.telegram_id || '', enabled: !!status.data?.telegram_oauth },
    { key: 'linuxdo', label: 'LinuxDO', value: detail?.linux_do_id || '', enabled: !!status.data?.linuxdo_oauth },
  ]
  const providers = status.data?.custom_oauth_providers || []
  const custom: Binding[] = providers.map((provider) => ({
    key: `custom-${provider.id}`,
    label: provider.name,
    value: query.data?.bindings.find((binding) => binding.provider_id === provider.id)?.provider_user_id || '',
    enabled: true,
    providerId: provider.id,
  }))
  for (const binding of query.data?.bindings || [])
    if (!providers.some((provider) => provider.id === binding.provider_id))
      custom.push({
        key: `custom-${binding.provider_id}`,
        label: binding.provider_name,
        value: binding.provider_user_id,
        enabled: false,
        providerId: binding.provider_id,
      })
  const bindings = [...builtins, ...custom].filter((binding) => !boundOnly || binding.value)
  const error = query.error || status.error
  const operation: VerificationOperation | null = pending
    ? {
        scope: 'admin.user.binding.clear',
        context: pending.providerId ? { user_id: user.id, provider_id: pending.providerId } : { user_id: user.id, binding_type: pending.key },
      }
    : null
  return (
    <>
      <Dialog
        open={!pending}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Account Binding Management')}</DialogTitle>
            <DialogDescription>
              {user.username} · #{user.id}
            </DialogDescription>
          </DialogHeader>
          <div className="action-buttons">
            <Button variant="outline" onClick={() => setBoundOnly(!boundOnly)}>
              {t(boundOnly ? 'Show all' : 'Show bound only')}
            </Button>
            <Button variant="outline" onClick={() => setReveal(!reveal)}>
              {t(reveal ? 'Hide identifiers' : 'Show identifiers')}
            </Button>
          </div>
          {error ? (
            <ErrorState
              error={error}
              retry={() => {
                void query.refetch()
                void status.refetch()
              }}
            />
          ) : !query.data || !status.data ? (
            <LoadingState />
          ) : !bindings.length ? (
            <EmptyState title={t('No bound accounts')} />
          ) : (
            <div className="binding-grid">
              {bindings.map((binding) => (
                <article key={binding.key}>
                  <div>
                    <strong>{t(binding.label)}</strong>
                    <p className="small-note">
                      {binding.value ? (reveal ? binding.value : `•••• ${binding.value.slice(-4)}`) : t('Not bound')}{' '}
                      {!binding.enabled && ` · ${t('Disabled')}`}
                    </p>
                  </div>
                  <Button variant="outline" disabled={!binding.value} onClick={() => setPending(binding)}>
                    {t('Unbind')}
                  </Button>
                </article>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {operation && pending && (
        <SecurityDialog
          operation={operation}
          title={`${t('Verify to unbind account')} · ${user.username} · ${t(pending.label)}`}
          onClose={() => setPending(null)}
          onAuthorized={async (proof, signal) => {
            await api(`/api/user/${user.id}/${pending.providerId ? `oauth/bindings/${pending.providerId}` : `bindings/${pending.key}`}`, {
              method: 'DELETE',
              headers: { 'X-Security-Proof': proof },
              signal,
            })
            signal.throwIfAborted()
            await Promise.all(
              ['admin-user-bindings', 'admin-users', 'self', 'oauth-bindings'].map((key) => queries.invalidateQueries({ queryKey: [key] }))
            )
            toast.success(t('Saved'))
          }}
        />
      )}
    </>
  )
}
