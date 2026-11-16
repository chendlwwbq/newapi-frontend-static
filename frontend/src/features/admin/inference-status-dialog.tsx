'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { metricValue, metricMean, metricRatio, recentMetrics, type InferenceStatus } from './lib/inference-status'
import type { Channel } from './types'

const endpointErrors: Record<string, string> = {
  request_failed: 'Request failed',
  http_error: 'HTTP error',
  invalid_response: 'Invalid response',
  response_too_large: 'Response too large',
}
type MetricRow = { label: string; value: number | undefined; unit?: 'percent' | 'seconds' | 'rate'; details?: string }
export function InferenceStatusDialog({
  channel,
  ownerId,
  operate,
  write,
  onOperations,
  onClose,
}: {
  channel: Channel
  ownerId: number
  operate: boolean
  write: boolean
  onOperations: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation(),
    locale = toIntlLocale(i18n.language),
    sglang = channel.type === 63,
    provider = sglang ? 'sglang' : 'vllm'
  const [automatic, setAutomatic] = useState(true),
    previous = useRef<InferenceStatus | undefined>(undefined)
  const query = useQuery({
    queryKey: ['channel-inference-status', ownerId, channel.id, provider],
    queryFn: async ({ signal }) => {
      const snapshot = await api<InferenceStatus>(`/api/channel/${channel.id}/${provider}/status`, { signal })
      signal.throwIfAborted()
      const recent = recentMetrics(snapshot, previous.current)
      previous.current = snapshot
      return { snapshot, recent }
    },
    gcTime: 0,
    retry: false,
    refetchInterval: automatic ? 5000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })
  const snapshot = query.data?.snapshot,
    metrics = snapshot?.metrics || [],
    recent = query.data?.recent
  const current: MetricRow[] = [
    { label: 'Running requests', value: metricValue(metrics, sglang ? 'sglang:num_running_reqs' : 'vllm:num_requests_running') },
    { label: 'Waiting requests', value: metricValue(metrics, sglang ? 'sglang:num_queue_reqs' : 'vllm:num_requests_waiting') },
    {
      label: sglang ? 'Peak token pool usage' : 'Peak KV cache usage',
      value: sglang
        ? metricValue(metrics, 'sglang:token_usage', {}, 'max')
        : (metricValue(metrics, 'vllm:kv_cache_usage_perc', {}, 'max') ?? metricValue(metrics, 'vllm:gpu_cache_usage_perc', {}, 'max')),
      unit: 'percent',
    },
  ]
  if (sglang) current.push({ label: 'Output token rate', value: metricValue(metrics, 'sglang:gen_throughput'), unit: 'rate' })
  else current.push({ label: 'Awake engines', value: metricValue(metrics, 'vllm:engine_sleep_state', { sleep_state: 'awake' }) })
  const cumulative: MetricRow[] = [
    {
      label: sglang ? 'Processed requests' : 'Finished requests',
      value: metricValue(metrics, sglang ? 'sglang:num_requests_total' : 'vllm:request_success_total'),
    },
    { label: 'Input tokens', value: metricValue(metrics, `${provider}:prompt_tokens_total`) },
    { label: 'Output tokens', value: metricValue(metrics, `${provider}:generation_tokens_total`) },
    { label: 'Mean time to first token', value: metricMean(metrics, `${provider}:time_to_first_token_seconds`), unit: 'seconds' },
    { label: 'Mean request latency', value: metricMean(metrics, `${provider}:e2e_request_latency_seconds`), unit: 'seconds' },
    {
      label: 'Mean queue time',
      value: metricMean(metrics, sglang ? 'sglang:queue_time_seconds' : 'vllm:request_queue_time_seconds'),
      unit: 'seconds',
    },
    {
      label: 'Mean time per output token',
      value: sglang
        ? (metricMean(metrics, 'sglang:inter_token_latency_seconds') ?? metricMean(metrics, 'sglang:time_per_output_token_seconds'))
        : metricMean(metrics, 'vllm:request_time_per_output_token_seconds'),
      unit: 'seconds',
    },
  ]
  if (sglang) cumulative.push({ label: 'Cached tokens', value: metricValue(metrics, 'sglang:cached_tokens_total') })
  else
    cumulative.push(
      {
        label: 'Prefix cache hit rate',
        value: metricRatio(metricValue(metrics, 'vllm:prefix_cache_hits_total'), metricValue(metrics, 'vllm:prefix_cache_queries_total')),
        unit: 'percent',
      },
      {
        label: 'Speculative decoding acceptance rate',
        value: metricRatio(
          metricValue(metrics, 'vllm:spec_decode_num_accepted_tokens_total'),
          metricValue(metrics, 'vllm:spec_decode_num_draft_tokens_total')
        ),
        unit: 'percent',
      }
    )
  const interval: MetricRow[] = [
    {
      label: 'Input token rate',
      value: metricRatio(metricValue(recent?.metrics || [], `${provider}:prompt_tokens_total`), recent?.seconds),
      unit: 'rate',
    },
    {
      label: 'Output token rate',
      value: metricRatio(metricValue(recent?.metrics || [], `${provider}:generation_tokens_total`), recent?.seconds),
      unit: 'rate',
    },
    { label: 'Mean time to first token', value: metricMean(recent?.metrics || [], `${provider}:time_to_first_token_seconds`), unit: 'seconds' },
    { label: 'Mean request latency', value: metricMean(recent?.metrics || [], `${provider}:e2e_request_latency_seconds`), unit: 'seconds' },
  ]
  const groups: { title: string; hint?: string; rows: MetricRow[] }[] = [
    { title: 'Current load', rows: current },
    {
      title: 'Cumulative usage',
      hint: t('Counters and averages cover the period since the upstream metrics were initialized or reset.'),
      rows: cumulative,
    },
    {
      title: 'Since previous sample',
      hint: recent
        ? t('Sample interval: {{seconds}} seconds', { seconds: formatNumber(recent.seconds, locale) })
        : t('Waiting for two comparable samples. Counter resets restart the sampling window.'),
      rows: interval,
    },
  ]
  if (sglang) {
    const workers = metrics.filter((metric) => ['sglang:cache_hit_rate', 'sglang:spec_accept_rate'].includes(metric.name))
    if (workers.length)
      groups.push({
        title: 'Worker metrics',
        rows: workers.map((metric) => ({
          label: metric.name === 'sglang:cache_hit_rate' ? 'Prefix cache hit rate' : 'Speculative decoding acceptance rate',
          value: metric.value,
          unit: 'percent',
          details: JSON.stringify(metric.labels),
        })),
      })
  }
  function exportSnapshot() {
    if (!snapshot) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })),
      link = document.createElement('a')
    link.href = url
    link.download = `eva-${provider}-${channel.id}-${snapshot.sampled_at}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="admin-editor inference-status-dialog">
        <DialogHeader>
          <DialogTitle>
            {t(sglang ? 'SGLang status' : 'vLLM status')} · {channel.name}
          </DialogTitle>
        </DialogHeader>
        <div className="action-buttons">
          <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>
            {t('Refresh')}
          </Button>
          <Button variant="outline" disabled={!operate || !write} onClick={onOperations}>
            {t('Sync models')}
          </Button>
          <Button variant="outline" disabled={!operate} onClick={onOperations}>
            {t('Test Connection')}
          </Button>
          <Button variant="outline" disabled={!snapshot} onClick={exportSnapshot}>
            {t('Export snapshot')}
          </Button>
          <label className="checkbox-label">
            <input type="checkbox" checked={automatic} onChange={(event) => setAutomatic(event.target.checked)} />
            {t('Auto refresh (5s)')}
          </label>
        </div>
        {query.isPending && <LoadingState />}
        {query.error && !snapshot && <ErrorState error={query.error} retry={() => query.refetch()} />}{' '}
        {query.error && snapshot && <p role="alert">{t('Refresh failed. Showing the last successful snapshot.')}</p>}
        {snapshot && (
          <>
            <p className="small-note">
              {t('Version')}: {snapshot.version || t('Unavailable')} · {new Date(snapshot.sampled_at).toLocaleString(locale)}
            </p>
            <dl className="inference-endpoints">
              {Object.entries(snapshot.endpoints).map(([path, endpoint]) => (
                <div key={path}>
                  <dt>
                    <code>{path}</code>
                  </dt>
                  <dd className={endpoint.error ? 'inline-error' : ''}>
                    {t(endpoint.error ? 'Unavailable' : 'Available')}
                    {endpoint.status > 0 && ` · HTTP ${endpoint.status}`}
                    {endpoint.error && ` · ${t(endpointErrors[endpoint.error] || 'Unavailable')}`}
                  </dd>
                </div>
              ))}
            </dl>
            {sglang && snapshot.endpoints['/metrics']?.error && (
              <p className="small-note">{t('Start SGLang with --enable-metrics to expose Prometheus metrics.')}</p>
            )}
            <section>
              <h3>{t('Models')}</h3>
              {snapshot.models.length ? (
                snapshot.models.map((model) => (
                  <div className="inference-model" key={model.id}>
                    <strong>{model.id}</strong>
                    <span>
                      {t('Model source')}: {model.root || t('Unavailable')}
                    </span>
                    <span>
                      {t('Max context tokens')}: {model.max_model_len === null ? t('Unavailable') : formatNumber(model.max_model_len, locale)}
                    </span>
                  </div>
                ))
              ) : (
                <p>{t(snapshot.endpoints['/v1/models']?.error ? 'Unavailable' : 'No models found')}</p>
              )}
            </section>
            {groups.map((group) => (
              <section key={group.title}>
                <h3>{t(group.title)}</h3>
                {group.hint && <p className="small-note">{group.hint}</p>}
                <dl className="inference-metrics">
                  {group.rows.map((row) => {
                    let value = t('Unavailable')
                    if (row.value !== undefined) {
                      value = formatNumber(row.value, locale)
                      if (row.unit === 'percent')
                        value = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(row.value)
                      if (row.unit === 'seconds')
                        value = new Intl.NumberFormat(locale, { style: 'unit', unit: 'second', maximumFractionDigits: 2 }).format(row.value)
                      if (row.unit === 'rate') value = t('{{value}} tokens/s', { value })
                    }
                    return (
                      <div key={`${row.label}:${row.details || ''}`}>
                        <dt>{t(row.label)}</dt>
                        <dd>{value}</dd>
                        {row.details && <small>{row.details}</small>}
                      </div>
                    )
                  })}
                </dl>
              </section>
            ))}
            <details>
              <summary>{t('Raw metrics')}</summary>
              <CopyButton value={snapshot.raw_metrics} />
              <pre className="inference-raw">{snapshot.raw_metrics}</pre>
            </details>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
