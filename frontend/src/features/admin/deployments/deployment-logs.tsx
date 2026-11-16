'use client'
import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { deploymentPath } from './contracts'
export function DeploymentLogs(props: { id: string; container: string }) {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    [auto, setAuto] = useState(false)
  const [filters, setFilters] = useState({ stream: 'all', level: '', cursor: '', limit: '100', start_time: '', end_time: '' }),
    [submitted, setSubmitted] = useState(filters)
  const params = new URLSearchParams({ container_id: props.container, follow: 'false', ...submitted })
  const query = useQuery({
    queryKey: ['deployment-logs', bundle?.user.id, props.id, props.container, submitted],
    gcTime: 0,
    queryFn: ({ signal }) => api<string>(deploymentPath(props.id, `/logs?${params}`), { signal }),
    refetchInterval: auto ? 5000 : false,
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (JSON.stringify(filters) === JSON.stringify(submitted)) void query.refetch()
    else setSubmitted({ ...filters })
  }
  let content
  if (query.error) content = <ErrorState error={query.error} retry={() => query.refetch()} />
  else if (query.isPending) content = <LoadingState />
  else
    content = (
      <>
        <CopyButton value={query.data || ''} />
        <pre className="deployment-log-output">{query.data || t('No logs')}</pre>
      </>
    )
  return (
    <section>
      <h3>{t('Container logs')}</h3>
      <form className="admin-form-grid" onSubmit={submit}>
        <label className="field">
          <span>{t('Stream')}</span>
          <select value={filters.stream} onChange={(event) => setFilters({ ...filters, stream: event.target.value })}>
            {['all', 'stdout', 'stderr'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Level')}</span>
          <Input value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('Cursor')}</span>
          <Input value={filters.cursor} onChange={(event) => setFilters({ ...filters, cursor: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('Limit')}</span>
          <Input
            type="number"
            required
            min={1}
            max={1000}
            step={1}
            value={filters.limit}
            onChange={(event) => setFilters({ ...filters, limit: event.target.value })}
          />
        </label>
        {(['start_time', 'end_time'] as const).map((key) => (
          <label className="field" key={key}>
            <span>{t(key === 'start_time' ? 'Start time (ISO 8601)' : 'End time (ISO 8601)')}</span>
            <Input value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} />
          </label>
        ))}
        <Button type="submit" variant="outline" disabled={query.isFetching}>
          {t('Refresh')}
        </Button>
        <label className="checkbox-label">
          <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
          {t('Auto refresh')}
        </label>
      </form>
      {content}
    </section>
  )
}
