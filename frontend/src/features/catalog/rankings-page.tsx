'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, LoadingState } from '@/components/shared/states'
import { Reveal } from '@/components/motion/reveal'
import { RankingsHistoryChart } from './rankings-history-chart'
import { ProviderIcon } from './model-card'
import { ModuleAccessError } from './module-access-error'
import { UNKNOWN_PROVIDER } from './catalog-state'
import type { RankingPeriod, RankingsSnapshot } from './rankings-types'

const periods: [RankingPeriod, string][] = [
  ['today', 'Today'],
  ['week', 'This week'],
  ['month', 'Month'],
  ['year', 'This year'],
]
export function RankingsPage() {
  const { t, i18n } = useTranslation(),
    auth = useAuth(),
    [period, setPeriod] = useState<RankingPeriod>('week'),
    [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['rankings', period, auth.bundle?.user.id || 0],
    enabled: auth.phase === 'ready',
    queryFn: ({ signal }) => api<RankingsSnapshot>(`/api/rankings?period=${period}`, { signal }),
  })
  const locale = toIntlLocale(i18n.language),
    number = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }),
    percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }),
    growth = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 1 }),
    growthPercent = new Intl.NumberFormat(locale, { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 1 })
  const vendorHref = (vendor: string) => {
    const params = new URLSearchParams()
    params.append('provider', vendor)
    if (vendor === 'Unknown') params.append('provider', UNKNOWN_PROVIDER)
    return `/pricing?${params}`
  }
  const data = query.data
  const models = data?.models.filter((model) => `${model.model_name} ${model.vendor}`.toLowerCase().includes(search.toLowerCase())) || []
  const moverSections: [RankingsSnapshot['top_movers'], string][] = data
    ? [
        [data.top_movers, 'Rising models'],
        [data.top_droppers, 'Falling models'],
      ]
    : []
  return (
    <main className="page-container rankings-page" id="content">
      <div className="page-heading">
        <div>
          <p className="docs-eyebrow">
            <span className="brand-word">eva</span> · {t('Rankings')}
          </p>
          <h1 className="page-title">{t('Rankings')}</h1>
          <p className="page-description">{t('Based on recorded gateway usage. Empty periods have no synthetic rankings.')}</p>
        </div>
        <div className="rankings-period" role="group" aria-label={t('Time range')}>
          {periods.map(([value, label]) => (
            <Button
              type="button"
              key={value}
              variant={period === value ? 'default' : 'outline'}
              onClick={() => setPeriod(value)}
              aria-pressed={period === value}
            >
              {t(label)}
            </Button>
          ))}
        </div>
      </div>
      {query.error ? (
        <ModuleAccessError error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : !data?.models.length ? (
        <EmptyState title={t('No data yet')} />
      ) : (
        <>
          <Reveal className="console-panel rankings-history">
            <h2>{t('Top models token history')}</h2>
            <RankingsHistoryChart key={`models-${period}`} source={data.models_history} />
          </Reveal>
          <Reveal className="console-panel rankings-history">
            <h2>{t('Provider share history')}</h2>
            <RankingsHistoryChart key={`vendors-${period}`} source={data.vendor_share_history} share />
          </Reveal>
          <div className="rankings-layout">
            <section className="console-panel">
              <div className="page-heading">
                <h2>{t('Models')}</h2>
                <Input
                  aria-label={t('Search models')}
                  placeholder={t('Search models')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('Model')}</th>
                      <th>{t('Tokens')}</th>
                      <th>{t('Share')}</th>
                      <th>{t('Growth')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <tr key={model.model_name}>
                        <td>{model.rank}</td>
                        <td>
                          <div className="rankings-model">
                            <ProviderIcon provider={model.vendor} modelName={model.model_name} />
                            <div>
                              <Link href={`/pricing/${encodeURIComponent(model.model_name)}`}>{model.model_name}</Link>
                              <small>
                                <Link href={vendorHref(model.vendor)}>{model.vendor === 'Unknown' ? t('Unknown') : model.vendor}</Link>
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>{number.format(model.total_tokens)}</td>
                        <td>{percent.format(model.share)}</td>
                        <td>{growthPercent.format(model.growth_pct / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!models.length && <EmptyState title={t('No data')} />}
              </div>
            </section>
            <aside className="rankings-sidebar">
              <section className="console-panel">
                <h2>{t('Providers')}</h2>
                {data.vendors.map((vendor) => (
                  <div className="rankings-vendor" key={vendor.vendor}>
                    <div>
                      <ProviderIcon provider={vendor.vendor} />
                      <strong>
                        <Link href={vendorHref(vendor.vendor)}>{vendor.vendor === 'Unknown' ? t('Unknown') : vendor.vendor}</Link>
                      </strong>
                      <span>{percent.format(vendor.share)}</span>
                    </div>
                    <meter value={vendor.share} min={0} max={1} aria-label={vendor.vendor} />
                    <small>
                      {number.format(vendor.total_tokens)} {t('Tokens')} · {vendor.models_count} {t('Models')}
                    </small>
                  </div>
                ))}
              </section>
            </aside>
          </div>
          <div className="rankings-movers">
            {moverSections.map(([items, label]) => (
              <section className="console-panel" key={label}>
                <h2>{t(label)}</h2>
                {items.length ? (
                  items.map((model) => (
                    <div className="rankings-mover" key={model.model_name}>
                      <div>
                        <Link href={`/pricing/${encodeURIComponent(model.model_name)}`}>{model.model_name}</Link>
                        <small>
                          #{formatNumber(model.current_rank, locale)} ·{' '}
                          <Link href={vendorHref(model.vendor)}>{model.vendor === 'Unknown' ? t('Unknown') : model.vendor}</Link>
                        </small>
                      </div>
                      <strong>{growth.format(model.rank_delta)}</strong>
                    </div>
                  ))
                ) : (
                  <p className="small-note">{t('No data')}</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
