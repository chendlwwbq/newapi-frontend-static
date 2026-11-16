'use client'
import { catalogGroupLabel } from './group-label'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, LoadingState } from '@/components/shared/states'
import { api } from '@/lib/api/client'
import { useAuth, refreshSession } from '@/lib/auth/session'
import type { Catalog } from '@/lib/api/types'
import { ModuleAccessError } from './module-access-error'
import { catalogModelKey, connectReturnPath, connectRoute, modelDetailHref } from './catalog-state'
import { ApiReference } from '@/features/docs/api-reference'
import { useGatewayAddress } from '@/features/docs/use-gateway-address'
import { routeEndpoints } from '@/features/docs/api-examples'
import { ErrorState } from '@/components/shared/states'
import { ConnectKeySelector } from '@/features/tokens/connect-key-selector'
import { ConnectTools } from './connect-tools'

export function ConnectPage({
  model,
  group,
  catalogKey,
  offeringKey,
  currency = 'CNY',
}: {
  model: string
  group?: string
  catalogKey?: string
  offeringKey?: string
  currency?: 'CNY' | 'USD'
}) {
  const { t } = useTranslation(),
    auth = useAuth(),
    gateway = useGatewayAddress()
  const key = catalogKey || model,
    keyType = catalogKey ? 'catalog_key' : 'model_id'
  const catalog = useQuery({
    queryKey: catalogModelKey(key, 'CNY', auth.bundle, keyType),
    enabled: auth.phase === 'ready',
    queryFn: ({ signal }) => api<Catalog>(`/api/catalog/model?${new URLSearchParams({ key, key_type: keyType, currency: 'CNY' })}`, { signal }),
  })
  const origin = gateway.address
  if (auth.phase === 'error')
    return (
      <main className="page-container" id="content">
        <ErrorState
          error={new Error(auth.error || 'Session refresh failed')}
          retry={() => {
            void refreshSession().catch((error) => toast.error(t(error.message)))
          }}
        />
      </main>
    )
  if (gateway.error)
    return (
      <main className="page-container" id="content">
        <ErrorState error={gateway.error} retry={gateway.retry} />
      </main>
    )
  if (catalog.error)
    return (
      <main className="page-container" id="content">
        <ModuleAccessError
          error={catalog.error}
          retry={() => catalog.refetch()}
          returnTo={connectReturnPath(model, group, catalogKey, offeringKey, currency)}
        />
      </main>
    )
  if (catalog.isPending || !origin)
    return (
      <main className="page-container" id="content">
        <LoadingState />
      </main>
    )
  const route = connectRoute(catalog.data?.model, group, offeringKey)
  const detailsHref = modelDetailHref(model, catalogKey, group, currency)
  if (!route)
    return (
      <main className="page-container" id="content">
        <EmptyState title={t('No routes available')} />
        <Link href={detailsHref} className="text-link">
          {t('Model')} ↗
        </Link>
      </main>
    )
  const endpoints = routeEndpoints(route, origin, model),
    openAI = endpoints.some((endpoint) =>
      ['openai', 'openai-response', 'openai-response-compact', 'openai-alpha-search', 'image-generation', 'openai-video', 'embeddings'].includes(
        endpoint.id
      )
    )
  return (
    <main className="page-container" id="content">
      <div className="docs-layout">
        <aside className="docs-sidebar">
          <Link href={detailsHref}>← {t('Model')}</Link>
          <Link href="/docs">{t('Docs')}</Link>
        </aside>
        <article className="docs-article">
          <p className="docs-eyebrow">eva · {t('Quick connect')}</p>
          <h1>{model}</h1>
          <p>{t('Create an account, choose a model and route, then create an API key.')}</p>
          <h2>01 · {t('Create API key')}</h2>
          <p>
            {t('Group')}: <strong>{catalogGroupLabel(route.name, t, route.public_description)}</strong>
          </p>
          <Link
            className="pill-button"
            href={`/keys?create=1&group=${encodeURIComponent(route.name)}&returnTo=${encodeURIComponent(connectReturnPath(model, group, catalogKey, offeringKey, currency))}`}
          >
            {t('Create Key for this route')}
          </Link>
          {auth.bundle && (
            <ConnectKeySelector
              key={`${auth.bundle.user.id}:${auth.bundle.session.sid}:${route.name}`}
              userId={auth.bundle.user.id}
              sessionId={auth.bundle.session.sid}
              group={route.name}
              groupLabel={catalogGroupLabel(route.name, t, route.public_description)}
              userGroup={auth.bundle.user.group}
            />
          )}
          <h2>02 · {t('Base URL')}</h2>
          <div className="code-preview">
            <div>
              <span>{t('Base URL')}</span>
              <CopyButton value={origin} />
            </div>
            <pre>{origin}</pre>
          </div>
          {openAI && (
            <div className="code-preview">
              <div>
                <span>OpenAI · {t('Base URL')}</span>
                <CopyButton value={`${origin}/v1`} />
              </div>
              <pre>{origin}/v1</pre>
            </div>
          )}
          {endpoints.map((endpoint) => (
            <div className="code-preview" key={endpoint.id}>
              <div>
                <span>{t(endpoint.label)}</span>
                <CopyButton value={endpoint.url} />
              </div>
              <pre>{endpoint.url}</pre>
            </div>
          ))}
          <ConnectTools
            key={`${auth.bundle?.user.id ?? 'public'}:${auth.bundle?.session.sid ?? 'public'}:${route.offering_key}`}
            route={route}
            model={model}
            address={origin}
            signedIn={!!auth.bundle}
            returnTo={connectReturnPath(model, group, catalogKey, offeringKey, currency)}
          />
          <ApiReference initialModel={catalog.data?.model} offering={route} currency={currency} />
          <p>{t('Your console shows request logs, usage and remaining balance.')}</p>
        </article>
      </div>
    </main>
  )
}
