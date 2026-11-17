'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/shared/copy-button'
import { ConfiguredPanels } from '@/features/dashboard/configured-panels'
import { ChatClients } from '@/features/chat/chat-clients'
import { RestPublishedCatalog } from '@/features/developer/rest-published'
import { ApiReference } from './api-reference'
import { useGatewayAddress } from './use-gateway-address'
import { ErrorState } from '@/components/shared/states'
export function ApiHub() {
  const { t } = useTranslation(),
    { address, error, retry } = useGatewayAddress()
  if (error) return <ErrorState error={error} retry={retry} />
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('API hub')}</h1>
          <p>{t('Connect tools using your Base URL and API Key.')}</p>
        </div>
        <Link className="text-link" href="/docs/api">
          {t('API reference')} ↗
        </Link>
      </div>
      <section className="console-panel">
        <h2>{t('Base URL')}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <code className="rounded-xl border border-border/70 bg-muted/50 px-3.5 py-2 font-mono text-sm text-foreground">
            {address ? `${address}/v1` : '—'}
          </code>
          {address && <CopyButton value={`${address}/v1`} />}
        </div>
        <p className="small-note mt-4">
          {t('Create an account, choose a model and route, then create an API key.')}
        </p>
        <Link href="/keys" className="text-link">
          {t('API keys')} ↗
        </Link>
      </section>
      <section className="console-panel">
        <ApiReference modelPicker />
      </section>
      <RestPublishedCatalog />
      <ConfiguredPanels apiOnly />
      <ChatClients />
    </>
  )
}
