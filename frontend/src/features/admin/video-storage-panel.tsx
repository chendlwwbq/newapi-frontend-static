'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudUpload, Power, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { formatNumber, dateTime } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'

type VideoStorageStatus = {
  enabled: boolean
  configured: boolean
  bucket_host: string
  sources: string[]
  signed_url_hours: number
  channels?: { id: number; name: string; status: number; storage_enabled: boolean; direct_only: boolean }[]
  usage?: {
    status: 'ready' | 'pending' | 'stale' | 'unavailable'
    used_bytes: number | null
    object_count: number | null
    updated_at: number
    refreshing: boolean
  }
}

export function VideoStoragePanel() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [search, setSearch] = useState('')
  const { bundle } = useAuth()
  const queries = useQueryClient()
  const root = bundle?.user.role === 100
  const status = useQuery({
    queryKey: ['video-storage', bundle?.user.id],
    enabled: root,
    queryFn: ({ signal }) => api<VideoStorageStatus>('/api/option/video_storage', { signal }),
    refetchInterval: (query) => (query.state.data?.usage?.refreshing ? 5000 : false),
  })
  const channelToggle = useMutation({
    mutationFn: (channel: { id: number; enabled: boolean }) =>
      api('/api/option', {
        method: 'PUT',
        body: { key: `VideoStorageChannelEnabled:${channel.id}`, value: channel.enabled },
      }),
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: ['video-storage'] })
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api('/api/option', { method: 'PUT', body: { key: 'VideoStorageEnabled', value: enabled } }),
    onSuccess: async () => {
      await Promise.all([queries.invalidateQueries({ queryKey: ['video-storage'] }), queries.invalidateQueries({ queryKey: ['system-options'] })])
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })

  if (!root) return null
  if (status.error) return <ErrorState error={status.error} retry={() => status.refetch()} />
  if (status.isPending) return <LoadingState />

  const data = status.data
  const usage = data.usage
  const channels = (data.channels ?? []).filter((channel) => `${channel.id} ${channel.name}`.toLowerCase().includes(search.toLowerCase()))
  let toggleLabel = data.enabled ? 'Pause automatic storage' : 'Enable automatic storage'
  if (toggle.isPending) toggleLabel = 'Saving'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CloudUpload size={22} aria-hidden="true" />
            <h2>{t('Automatic video storage')}</h2>
          </div>
          <p className="small-note">{t('Completed videos are automatically saved to your private storage bucket.')}</p>
        </div>
        <Button variant="outline" disabled={status.isFetching || toggle.isPending} onClick={() => status.refetch()}>
          <RefreshCw size={15} aria-hidden="true" />
          {t('Refresh')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-5">
        <div className="space-y-1">
          <strong aria-live="polite">{t(data.enabled && data.configured ? 'Enabled' : 'Disabled')}</strong>
          <p className="small-note">{t('Turning this off pauses new transfers. Accepted transfers and existing links remain available.')}</p>
        </div>
        <Button
          role="switch"
          aria-label={t('Automatic video storage')}
          aria-checked={data.enabled && data.configured}
          disabled={toggle.isPending || !data.configured}
          variant={data.enabled ? 'outline' : 'default'}
          onClick={() => toggle.mutate(!data.enabled)}
        >
          <Power size={15} aria-hidden="true" />
          {t(toggleLabel)}
        </Button>
      </div>

      {!data.configured && (
        <p role="status" className="small-note">
          {t('The storage service has not been configured on the server.')}
        </p>
      )}
      <dl className="ops-details">
        <div>
          <dt>{t('Storage bucket')}</dt>
          <dd className="break-all">{data.bucket_host || '—'}</dd>
        </div>
        <div>
          <dt>{t('Connected video models')}</dt>
          <dd>{data.sources.join(' / ') || '—'}</dd>
        </div>
        <div>
          <dt>{t('Signed link validity')}</dt>
          <dd>{t('{{count}} hours', { count: data.signed_url_hours })}</dd>
        </div>
      </dl>
      <section className="space-y-3" aria-label={t('Bucket usage')}>
        <h3>{t('Bucket usage')}</h3>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <dt className="small-note">{t('Stored object size')}</dt>
            <dd className="mt-2 text-xl font-semibold">
              {usage?.used_bytes == null ? '—' : `${formatNumber(usage.used_bytes / 1024 ** 3, locale)} GiB`}
            </dd>
          </div>
          <div className="rounded-xl border border-border p-4">
            <dt className="small-note">{t('Stored objects')}</dt>
            <dd className="mt-2 text-xl font-semibold">{usage?.object_count == null ? '—' : formatNumber(usage.object_count, locale)}</dd>
          </div>
          <div className="rounded-xl border border-border p-4">
            <dt className="small-note">{t('Last usage update')}</dt>
            <dd className="mt-2 break-words">{usage?.updated_at ? dateTime(usage.updated_at, locale) : '—'}</dd>
          </div>
        </dl>
        <p className="small-note">
          {t(
            'Usage counts current objects in the whole bucket. Historical versions and unfinished multipart uploads are excluded. This is not a fixed capacity limit.'
          )}
        </p>
        {usage?.refreshing && (
          <p role="status" className="small-note">
            {t('Refreshing bucket usage')}
          </p>
        )}
        {(!usage || usage.status === 'unavailable') && (
          <p role="status" className="small-note">
            {t('Bucket usage is unavailable. Check the download service and bucket listing permission.')}
          </p>
        )}
        {usage?.status === 'stale' && (
          <p role="status" className="small-note">
            {t('Usage refresh failed. Showing the last successful result.')}
          </p>
        )}
      </section>

      <section className="space-y-4" aria-label={t('Channel storage policy')}>
        <div className="space-y-2">
          <h3>{t('Channel storage policy')}</h3>
          <p className="small-note">
            {t(
              'Disable storage to return the original video link. Sources requiring credentials use the gateway download endpoint without bucket transfer.'
            )}
          </p>
          <p className="small-note">
            {t(
              'Changes apply to transfers not yet accepted by the download service. Existing files are retained. Re-enabling applies to new transfers.'
            )}
          </p>
          {!data.enabled && (
            <p role="status" className="small-note">
              {t('Automatic storage is paused globally. Channel preferences are retained.')}
            </p>
          )}
        </div>
        <Input
          aria-label={t('Search channels')}
          placeholder={t('Search channels')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-[32rem] space-y-2 overflow-y-auto">
          {channels.map((channel) => {
            let policyLabel = channel.storage_enabled ? 'Save to bucket' : 'Return original link'
            if (channel.direct_only) policyLabel = 'Provider link only'
            return (
              <div key={channel.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words font-medium">
                    #{channel.id} · {channel.name}
                  </p>
                  <p className="small-note">
                    {t(channel.status === 1 ? 'Enabled' : 'Disabled')} · {t(policyLabel)}
                  </p>
                </div>
                <Button
                  role="switch"
                  aria-label={t('Store videos for channel {{name}}', { name: channel.name })}
                  aria-checked={!channel.direct_only && channel.storage_enabled}
                  disabled={channel.direct_only || channelToggle.isPending || !data.configured}
                  variant={channel.storage_enabled && !channel.direct_only ? 'default' : 'outline'}
                  onClick={() => channelToggle.mutate({ id: channel.id, enabled: !channel.storage_enabled })}
                >
                  {t(channel.storage_enabled && !channel.direct_only ? 'Save to bucket' : 'Return original link')}
                </Button>
              </div>
            )
          })}
          {channels.length === 0 && <p className="small-note">{t('No results found')}</p>}
        </div>
      </section>
      <p className="small-note">{t('Bucket download links are available through the separate video-storage API.')}</p>
    </div>
  )
}
