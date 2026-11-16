'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Reveal } from '@/components/motion/reveal'
import { PriceDisplay } from '@/features/catalog/model-card'
import { quoteUnitLabel } from '@/features/catalog/price-format'
import { useGatewayAddress } from '@/features/docs/use-gateway-address'
import { apiProtocols } from '@/features/docs/api-examples'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import type { CatalogModel } from '@/lib/api/types'
import { homeConnection, type HomeSelection } from './home-connection'

export function HomeConnect(props: { models: CatalogModel[] }) {
  const { t, i18n } = useTranslation(),
    gateway = useGatewayAddress(),
    [selection, setSelection] = useState<HomeSelection>({ model: '', offering: '' })
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const current = homeConnection(props.models, selection)
  if (!current) return <EmptyState title={t('No models configured')} />
  const { model, offering } = current
  const protocols = [...new Set(offering?.access.flatMap((access) => access.protocols) || [])]
  return (
    <div className="home-connect-grid">
      <Reveal className="home-connect-step">
        <h3>
          <span>01</span>
          {t('Choose a model')}
        </h3>
        <div role="group" aria-label={t('Choose a model')} className="home-connect-options">
          {props.models.slice(0, 8).map((item) => (
            <Button
              type="button"
              variant="ghost"
              key={item.model_key}
              aria-pressed={item.model_key === model.model_key}
              onClick={() => setSelection({ model: item.model_key, offering: '' })}
            >
              <span>
                <strong>{item.name}</strong>
                <small>
                  {formatNumber(item.offerings_count, locale)} {t('Routes')}
                </small>
              </span>
              {item.model_key === model.model_key && <Check size={16} />}
            </Button>
          ))}
        </div>
        <Link href="/pricing" className="text-link">
          {t('Browse all models')}
          <ArrowRight size={14} />
        </Link>
      </Reveal>
      <Reveal delay={0.08} className="home-connect-step">
        <h3>
          <span>02</span>
          {t('Choose a route')}
        </h3>
        <div role="group" aria-label={t('Choose a route')} className="home-connect-options home-connect-routes">
          {model.offerings.map((route) => (
            <Button
              type="button"
              variant="ghost"
              key={route.offering_key}
              aria-pressed={route.offering_key === offering?.offering_key}
              onClick={() => setSelection({ model: model.model_key, offering: route.offering_key })}
            >
              <span>
                <strong>{route.name}</strong>
                <small>{t(quoteUnitLabel(route.prices[0]))}</small>
                <PriceDisplay quote={route.prices[0]} />
              </span>
              {route.offering_key === offering?.offering_key && <Check size={16} />}
            </Button>
          ))}
        </div>
        {!offering && <p className="small-note">{t('No routes available')}</p>}
        <p className="small-note">{t('Create a key in the selected group to use this route.')}</p>
      </Reveal>
      <Reveal delay={0.16} className="home-connect-step home-connect-card">
        <h3>
          <span>03</span>
          {t('Get your connection card')}
        </h3>
        <div className="home-connect-card-heading">
          <span>eva · {t('Quick connect')}</span>
          <strong>{offering?.name || '—'}</strong>
        </div>
        <div className="home-connect-flow">
          <span>{t('Your application')}</span>
          <ArrowRight size={18} aria-hidden="true" />
          <strong>{model.name}</strong>
        </div>
        <dl>
          <div>
            <dt>{t('API reference')}</dt>
            <dd>
              {protocols.length
                ? protocols.map((protocol) => t(apiProtocols.find((item) => item.id === protocol)?.label || protocol)).join(' · ')
                : t('See integration guide')}
            </dd>
          </div>
          <div>
            <dt>Base URL</dt>
            <dd>
              {gateway.error ? (
                <ErrorState error={gateway.error} retry={gateway.retry} />
              ) : (
                <>
                  <code>{gateway.address || '—'}</code>
                  {gateway.address && <CopyButton value={gateway.address} />}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>{t('Model ID')}</dt>
            <dd>
              <code>{offering?.invocation_id || model.configured_model_id}</code>
              <CopyButton value={offering?.invocation_id || model.configured_model_id} />
            </dd>
          </div>
          <div>
            <dt>{t('Price')}</dt>
            <dd>
              <PriceDisplay quote={offering?.prices[0]} />
            </dd>
          </div>
        </dl>
        {current.connectHref && current.keyHref && (
          <div className="home-connect-actions">
            <Link className="pill-button" href={current.connectHref}>
              {t('See integration guide')}
              <ArrowRight size={14} />
            </Link>
            <Link className="pill-button secondary" href={current.keyHref}>
              {t('Create Key for this route')}
            </Link>
          </div>
        )}
      </Reveal>
    </div>
  )
}
