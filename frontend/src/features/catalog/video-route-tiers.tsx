'use client'

import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Offering } from '@/lib/api/types'
import { videoResolutionRoutes, videoRouteSlot, videoRouteTiers, type VideoBillingMode } from './video-billing'

export function VideoRouteTiers(props: {
  mode?: VideoBillingMode
  groupByResolution?: boolean
  offerings: Offering[]
  renderRoute: (route: Offering, label?: string) => ReactNode
}) {
  const { t } = useTranslation()
  const labels = { 稳定: t('Stable video route'), 特价: t('Special video route'), 备选: t('Backup video route') }
  if (props.groupByResolution && !props.mode) {
    const { groups, other } = videoResolutionRoutes(props.offerings)
    return (
      <>
        {groups.map(({ resolution, routes }) => (
          <section key={resolution} className="video-resolution-group">
            <h3>{resolution.toUpperCase()}</h3>
            {(['request', 'second'] as const).map((mode) => {
              const matching = routes.filter(({ slot }) => slot.mode === mode)
              if (!matching.length) return null
              return (
                <section key={mode} className="video-billing-group">
                  <h4>{mode === 'request' ? t('Per request') : t('Per second')}</h4>
                  {videoRouteTiers.flatMap((tier) =>
                    matching.filter(({ slot }) => slot.tier === tier).map(({ route }) => props.renderRoute(route, labels[tier]))
                  )}
                </section>
              )
            })}
          </section>
        ))}
        {other.map((route) => props.renderRoute(route))}
      </>
    )
  }
  if (!props.mode) return <>{props.offerings.map((route) => props.renderRoute(route))}</>
  return (
    <>
      {videoRouteTiers.map((tier) => {
        const routes = props.offerings.filter((route) => videoRouteSlot(route)?.tier === tier)
        return (
          <Fragment key={tier}>
            {routes.length ? (
              routes.map((route) => props.renderRoute(route, labels[tier]))
            ) : (
              <div className="video-route-unavailable">
                <span>{labels[tier]}</span>
                <small>{t('Not available')}</small>
              </div>
            )}
          </Fragment>
        )
      })}
    </>
  )
}
