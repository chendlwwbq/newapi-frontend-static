'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/shared/copy-button'
import { useAuthStatus } from '@/features/auth/use-auth-status'

export function OAuthCallbacks({ serverAddress, slug }: { serverAddress: string; slug?: string }) {
  const { t } = useTranslation(),
    [origin, setOrigin] = useState(''),
    status = useAuthStatus()
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])
  const effectiveAddress = typeof status.data?.server_address === 'string' ? status.data.server_address : ''
  const site = (serverAddress.trim() || effectiveAddress.trim() || origin).replace(/\/+$/, '')
  if (!site) return null
  const providers = slug ? [slug] : ['github', 'discord', 'oidc', 'telegram', 'linuxdo']
  return (
    <details className="settings-callbacks">
      <summary>{t('OAuth callback URLs')}</summary>
      <p className="small-note">{t('Register these callback URLs with your identity provider. They use the configured server address.')}</p>
      {providers.map((provider) => {
        const value = `${site}/oauth/${provider}`
        return (
          <div className="settings-callback-row" key={provider}>
            <span>{provider}</span>
            <code>{value}</code>
            <CopyButton value={value} />
          </div>
        )
      })}
    </details>
  )
}
