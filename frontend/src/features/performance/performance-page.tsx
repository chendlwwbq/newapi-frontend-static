'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { OpsNav } from '@/features/admin/ops-nav'
import { ModelPerformance } from './model-performance'
import { usePerformanceOverview } from './use-performance'
export function PerformancePage() {
  const { t, i18n } = useTranslation(),
    [hours, setHours] = useState(24),
    [selected, setSelected] = useState(''),
    [search, setSearch] = useState(''),
    locale = toIntlLocale(i18n.language)
  const query = usePerformanceOverview(hours)
  const rows = (query.data?.models || []).filter((row) => row.model_name.toLowerCase().includes(search.toLowerCase()))
  let content
  if (query.error) content = <ErrorState error={query.error} retry={() => query.refetch()} />
  else if (query.isPending) content = <LoadingState />
  else if (!rows.length) content = <EmptyState title={t('No performance data in this time range')} />
  else
    content = (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {['Model', 'Average latency', 'Success rate', 'Output speed', 'Actions'].map((label) => (
                <th key={label}>{t(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.model_name}>
                <td>
                  <code>{row.model_name}</code>
                </td>
                <td>{formatNumber(row.avg_latency_ms, locale)} ms</td>
                <td>{formatNumber(row.success_rate, locale)}%</td>
                <td>{row.has_tps === false ? t('No measurements yet') : `${formatNumber(row.avg_tps, locale)} tokens/s`}</td>
                <td>
                  <Button size="sm" variant="outline" onClick={() => setSelected(row.model_name)}>
                    {t('Details')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Model performance')}</h1>
          <p>{t('Observed latency, output speed and success rate by model and group.')}</p>
        </div>
      </div>
      <OpsNav />
      <section className="console-panel">
        <div className="performance-filters">
          <label>
            {t('Search')}
            <Input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <FilterSelect
            className="toolbar-filter-select"
            label={t('Time range')}
            value={String(hours)}
            onChange={(value) => setHours(Number(value))}
            options={[6, 24, 72, 168].map((value) => ({ value: String(value), label: t('{{count}} hours', { count: value }) }))}
          />
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            {t('Refresh')}
          </Button>
        </div>
        {content}
      </section>
      {selected && <ModelPerformance key={selected} model={selected} />}
    </>
  )
}
