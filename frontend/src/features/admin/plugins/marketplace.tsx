'use client'
import { PluginIcon } from './plugin-icon'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { prepareMarketplaceUpload, marketplaceIconData, parseMarketplace, pluginHttpUrl, validateMarketplaceSources } from './transfer'
import type { MarketplacePlugin, MarketplaceSource, PluginUpload, TaskPlugin } from './types'

function MarketplaceIcon(props: { plugin: MarketplacePlugin; index: string }) {
  const icon = useQuery({
    queryKey: ['marketplace-icon', props.index, props.plugin.iconFile],
    enabled: !!props.plugin.iconFile,
    queryFn: ({ signal }) => marketplaceIconData(props.index, props.plugin.iconFile!, signal),
    staleTime: 300_000,
    retry: false,
    meta: { errorToast: false },
  })
  return <PluginIcon pluginKey={props.plugin.key} name={props.plugin.name} icon={props.plugin.icon} iconSrc={icon.data} />
}

function MarketplaceSources(props: { initial: MarketplaceSource[]; onClose: () => void }) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [sources, setSources] = useState(props.initial)
  const mutation = useMutation({
    mutationFn: () => api<MarketplaceSource[]>('/api/plugin/task/marketplace/sources', { method: 'PUT', body: validateMarketplaceSources(sources) }),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['task-plugin-sources'] })
      toast.success(t('Saved'))
      props.onClose()
    },
  })
  return (
    <form
      className="console-panel plugin-form"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <h3>{t('Marketplace sources')}</h3>
      <fieldset className="plugin-form" disabled={mutation.isPending}>
        {sources.map((source, index) => (
          <div className="plugin-source-row" key={index}>
            <label className="field">
              {t('Name')}
              <Input
                required
                value={source.name}
                onChange={(event) =>
                  setSources((previous) => previous.map((value, position) => (position === index ? { ...value, name: event.target.value } : value)))
                }
              />
            </label>
            <label className="field">
              {t('Index URL')}
              <Input
                required
                type="url"
                value={source.index_url}
                onChange={(event) =>
                  setSources((previous) =>
                    previous.map((value, position) => (position === index ? { ...value, index_url: event.target.value } : value))
                  )
                }
              />
            </label>
            <Button variant="outline" type="button" onClick={() => setSources((previous) => previous.filter((_, position) => position !== index))}>
              {t('Remove')}
            </Button>
          </div>
        ))}
        <div className="action-buttons">
          <Button type="button" variant="outline" onClick={() => setSources((previous) => [...previous, { name: '', index_url: '' }])}>
            {t('Add source')}
          </Button>
          <Button type="button" variant="outline" onClick={props.onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit">{t('Save')}</Button>
        </div>
      </fieldset>
      {mutation.error && (
        <p className="inline-error" role="alert">
          {t(mutation.error.message)}
        </p>
      )}
    </form>
  )
}
export function PluginMarketplace(props: { installed: TaskPlugin[]; onInstall: (upload: PluginUpload) => void }) {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    [sourceUrl, setSourceUrl] = useState(''),
    [editing, setEditing] = useState(false)
  const [catalog, setCatalog] = useState<{ url: string; plugins: MarketplacePlugin[] } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState('')
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({}),
    controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const sources = useQuery({
    queryKey: ['task-plugin-sources', bundle?.user.id, bundle?.session.sid],
    queryFn: ({ signal }) => api<MarketplaceSource[]>('/api/plugin/task/marketplace/sources', { signal }),
  })
  const url = sourceUrl || sources.data?.[0]?.index_url || ''
  async function load() {
    controller.current?.abort()
    controller.current = new AbortController()
    setBusy(true)
    setError('')
    setCatalog(null)
    try {
      const address = pluginHttpUrl(url),
        response = await fetch(address, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache', signal: controller.current.signal })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      setCatalog({ url: address, plugins: parseMarketplace(await response.json()) })
      setSelectedVersions({})
    } catch (error) {
      if (!controller.current.signal.aborted) setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function prepare(plugin: MarketplacePlugin) {
    if (!catalog) return
    const version = plugin.versions.find((item) => item.version === (selectedVersions[plugin.key] || plugin.latest))!
    controller.current = new AbortController()
    setBusy(true)
    setError('')
    try {
      const prepared = await prepareMarketplaceUpload(catalog.url, plugin, version, controller.current.signal)
      if (prepared.iconWarning) toast.warning(t(prepared.iconWarning))
      props.onInstall(prepared.upload)
    } catch (error) {
      if (!controller.current.signal.aborted) setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (sources.error) return <ErrorState error={sources.error} retry={() => sources.refetch()} />
  if (sources.isPending) return <LoadingState />
  const visibleCatalog = catalog?.url === url ? catalog : null
  return (
    <div className="plugin-form">
      <div className="console-toolbar admin-toolbar">
        <select
          className="plain-select"
          aria-label={t('Marketplace source')}
          value={url}
          disabled={busy}
          onChange={(event) => {
            setSourceUrl(event.target.value)
            setCatalog(null)
            setError('')
          }}
        >
          {sources.data?.map((source, index) => (
            <option key={`${source.index_url}:${index}`} value={source.index_url}>
              {source.name}
            </option>
          ))}
        </select>
        <Button variant="outline" disabled={busy || !url} onClick={load}>
          {t(busy ? 'Loading' : 'Load marketplace')}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => setEditing(!editing)}>
          {t('Manage sources')}
        </Button>
      </div>
      <p className="small-note">
        {t('Marketplace files are fetched by your browser without account credentials. The source must allow cross-origin requests.')}
      </p>
      {editing && <MarketplaceSources initial={sources.data || []} onClose={() => setEditing(false)} />}
      {error && (
        <p className="inline-error" role="alert">
          {t(error)}
        </p>
      )}
      {visibleCatalog && (
        <>
          <label className="field">
            {t('Search')}
            <Input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="plugin-market-grid">
            {visibleCatalog.plugins
              .filter((plugin) => `${plugin.name} ${plugin.key} ${plugin.models?.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
              .map((plugin) => {
                const installed = props.installed.find((item) => item.meta.key === plugin.key),
                  selected = plugin.versions.find((item) => item.version === (selectedVersions[plugin.key] || plugin.latest))!
                let description = plugin.description
                if (description && typeof description === 'object') description = description[i18n.language] || description.en || description.zh || ''
                return (
                  <article className="console-panel plugin-market-card" key={plugin.key}>
                    <div className="plugin-identity">
                      <MarketplaceIcon plugin={plugin} index={visibleCatalog.url} />
                      <div>
                        <h3>{plugin.name}</h3>
                        <code>{plugin.key}</code>
                      </div>
                    </div>
                    <p className="small-note">{description}</p>
                    <p>
                      {t('Installed version')}: {installed?.meta.version || '—'}
                    </p>
                    <label className="field">
                      {t('Version')}
                      <select
                        value={selected.version}
                        disabled={busy}
                        onChange={(event) => setSelectedVersions((previous) => ({ ...previous, [plugin.key]: event.target.value }))}
                      >
                        {plugin.versions.map((version) => (
                          <option key={version.version}>{version.version}</option>
                        ))}
                      </select>
                    </label>
                    <details>
                      <summary>{t('Capabilities')}</summary>
                      <pre className="admin-pricing-effective">
                        {JSON.stringify(
                          {
                            models: plugin.models,
                            minApiVersion: selected.minApiVersion,
                            allowedHosts: selected.allowedHosts,
                            baseUrl: selected.baseUrl,
                            auth: selected.auth,
                            sha256: selected.sha256,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                    {selected.minApiVersion !== undefined && selected.minApiVersion > 1 && (
                      <p className="inline-error">{t('This plugin requires a newer host API version.')}</p>
                    )}
                    <Button
                      disabled={busy || (selected.minApiVersion !== undefined && selected.minApiVersion > 1)}
                      variant="outline"
                      onClick={() => prepare(plugin)}
                    >
                      {t('Review source')}
                    </Button>
                  </article>
                )
              })}
          </div>
          {visibleCatalog.plugins.length === 0 && <p className="small-note">{t('No data')}</p>}
        </>
      )}
    </div>
  )
}
