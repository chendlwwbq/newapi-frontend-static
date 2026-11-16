'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import type { AffinityTarget } from '@/features/logs/contracts'
import { AdminConfirm } from './shared'
import { OpsNav } from './ops-nav'

interface CacheStats {
  enabled: boolean
  total: number
  unknown: number
  by_rule_name: Record<string, number>
  cache_capacity: number
  cache_algo: string
}
interface UsageStats {
  rule_name: string
  using_group: string
  key_fp: string
  cached_token_rate_mode: string
  hit: number
  total: number
  window_seconds: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cached_tokens: number
  prompt_cache_hit_tokens: number
  last_seen_at: number
}

export function AffinityUsage(props: { target: AffinityTarget }) {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    locale = toIntlLocale(i18n.language)
  const params = new URLSearchParams({ rule_name: props.target.rule_name, using_group: props.target.using_group, key_fp: props.target.key_fp })
  const query = useQuery({
    queryKey: ['affinity-usage', bundle?.user.id, params.toString()],
    gcTime: 0,
    queryFn: ({ signal }) => api<UsageStats>(`/api/log/channel_affinity_usage_cache?${params}`, { signal }),
  })
  let content
  if (query.error) content = <ErrorState error={query.error} retry={() => query.refetch()} />
  else if (query.isPending) content = <LoadingState />
  else if (!query.data.total) content = <EmptyState title={t('No data available')} />
  else {
    const row = query.data
    const rows: [string, string][] = [
      ['Rule', row.rule_name],
      ['Group', row.using_group],
      ['Key Summary', props.target.key_hint],
      ['Key Fingerprint', row.key_fp],
      ['Hit Rate', `${formatNumber(row.hit, locale)} / ${formatNumber(row.total, locale)} (${formatNumber((row.hit / row.total) * 100, locale)}%)`],
      ['TTL (seconds)', formatNumber(row.window_seconds, locale)],
      ['Input Tokens', formatNumber(row.prompt_tokens, locale)],
      ['Output Tokens', formatNumber(row.completion_tokens, locale)],
      ['Total tokens', formatNumber(row.total_tokens, locale)],
      ['Cached tokens', formatNumber(row.cached_tokens, locale)],
      ['Prompt cache hit tokens', formatNumber(row.prompt_cache_hit_tokens, locale)],
      ['Cache token rate mode', row.cached_token_rate_mode],
      ['Last Seen', row.last_seen_at ? new Date(row.last_seen_at * 1000).toLocaleString(locale, { hour12: false }) : '—'],
    ]
    content = (
      <dl className="ops-details">
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>
              {value || '—'}
              {key === 'Key Fingerprint' && <CopyButton value={value} />}
            </dd>
          </div>
        ))}
      </dl>
    )
  }
  return (
    <section className="affinity-usage">
      <p className="small-note">{t('Hit criteria: If cached tokens exist in usage, it counts as a hit.')}</p>
      <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
        {t('Refresh')}
      </Button>
      {content}
    </section>
  )
}

export function AffinityCachePage() {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    locale = toIntlLocale(i18n.language),
    root = bundle?.user.role === 100
  const [clear, setClear] = useState<{ rule?: string } | null>(null)
  const query = useQuery({
    queryKey: ['affinity-cache', bundle?.user.id],
    enabled: root,
    queryFn: ({ signal }) => api<CacheStats>('/api/option/channel_affinity_cache', { signal }),
  })
  const remove = useMutation({
    mutationFn: (target: { rule?: string }) =>
      api<{ deleted: number }>(
        `/api/option/channel_affinity_cache?${new URLSearchParams(target.rule ? { rule_name: target.rule } : { all: 'true' })}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      setClear(null)
      void query.refetch()
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  if (!root) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  let content
  if (query.error) content = <ErrorState error={query.error} retry={() => query.refetch()} />
  else if (query.isPending) content = <LoadingState />
  else
    content = (
      <>
        <dl className="ops-details">
          {[
            ['Status', t(query.data.enabled ? 'Enabled' : 'Disabled')],
            ['Total', formatNumber(query.data.total, locale)],
            ['Unknown', formatNumber(query.data.unknown, locale)],
            ['Cache capacity', formatNumber(query.data.cache_capacity, locale)],
            ['Cache algorithm', query.data.cache_algo || '—'],
          ].map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="action-buttons">
          <Button variant="destructive" disabled={!query.data.total} onClick={() => setClear({})}>
            {t('Clear all affinity cache')}
          </Button>
        </div>
        {Object.keys(query.data.by_rule_name || {}).length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Rule', 'Entries', 'Actions'].map((key) => (
                    <th key={key}>{t(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(query.data.by_rule_name).map(([rule, count]) => (
                  <tr key={rule}>
                    <td>
                      <code>{rule}</code>
                    </td>
                    <td>{formatNumber(count, locale)}</td>
                    <td>
                      <Button variant="outline" disabled={!count} onClick={() => setClear({ rule })}>
                        {t('Clear rule cache')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t('No cached affinity entries')} />
        )}
      </>
    )
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Affinity cache')}</h1>
          <p>{t('Inspect cached channel selections without changing affinity rules.')}</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          {t('Refresh')}
        </Button>
      </div>
      <OpsNav />
      <section className="console-panel">{content}</section>
      {clear && (
        <AdminConfirm
          title={t(clear.rule ? 'Clear rule cache' : 'Clear all affinity cache')}
          description={clear.rule || t('Clear cached channel selections for every rule. Rule configuration and usage logs are preserved.')}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(clear)}
          onClose={() => setClear(null)}
        />
      )}
    </>
  )
}
