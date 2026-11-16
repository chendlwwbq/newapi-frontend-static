'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { changedMetadataFields } from './metadata-diff'
import { PluginIcon } from './plugin-icon'
import { SourceDiffView } from './source-diff-view'
import type { PluginDetail, PluginRecord } from './types'

export function PluginVersionComparison(props: { pluginKey: string; versions: PluginRecord[]; selectedVersion: string }) {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    [before, setBefore] = useState(''),
    [after, setAfter] = useState(props.selectedVersion || props.versions.find((record) => !record.active)?.version || '')
  const path = `/api/plugin/task/${encodeURIComponent(props.pluginKey)}`
  const left = useQuery({
    queryKey: ['task-plugin-detail', bundle?.user.id, bundle?.session.sid, props.pluginKey, before],
    queryFn: ({ signal }) => api<PluginDetail>(`${path}${before ? `?version=${encodeURIComponent(before)}` : ''}`, { signal }),
  })
  const right = useQuery({
    queryKey: ['task-plugin-detail', bundle?.user.id, bundle?.session.sid, props.pluginKey, after],
    queryFn: ({ signal }) => api<PluginDetail>(`${path}${after ? `?version=${encodeURIComponent(after)}` : ''}`, { signal }),
  })
  const selectors = [
    { value: before, onChange: setBefore, label: 'Before version' },
    { value: after, onChange: setAfter, label: 'After version' },
  ]
  const fields = left.data && right.data ? changedMetadataFields(left.data.meta, right.data.meta) : []
  const error = left.error || right.error
  return (
    <section className="plugin-version-comparison">
      <p className="small-note">{t('Comparing versions does not activate or execute them.')}</p>
      <div className="settings-collection-grid">
        {selectors.map((selector) => (
          <label className="field" key={selector.label}>
            {t(selector.label)}
            <select value={selector.value} onChange={(event) => selector.onChange(event.target.value)}>
              <option value="">{t('Current saved version')}</option>
              {props.versions.map((record) => (
                <option key={record.id} value={record.version}>
                  {record.version}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {error && (
        <ErrorState
          error={error}
          retry={() => {
            void left.refetch()
            void right.refetch()
          }}
        />
      )}
      {(left.isPending || right.isPending) && <LoadingState />}
      {left.data && right.data && (
        <>
          <div className="plugin-compare-identities">
            <span className="plugin-identity">
              <PluginIcon
                pluginKey={props.pluginKey}
                version={before}
                name={left.data.meta.name}
                icon={left.data.meta.icon}
                hasIcon={left.data.has_icon}
                sourceHash={left.data.plugin?.source_hash}
              />
              <code>
                {left.data.meta.version} · {left.data.layer}
              </code>
            </span>
            <span aria-hidden="true">→</span>
            <span className="plugin-identity">
              <PluginIcon
                pluginKey={props.pluginKey}
                version={after}
                name={right.data.meta.name}
                icon={right.data.meta.icon}
                hasIcon={right.data.has_icon}
                sourceHash={right.data.plugin?.source_hash}
              />
              <code>
                {right.data.meta.version} · {right.data.layer}
              </code>
            </span>
          </div>
          <h3>{t('Metadata changes')}</h3>
          {!fields.length && <p className="small-note">{t('No metadata changes')}</p>}
          {fields.map((field) => (
            <details key={field} className="plugin-metadata-change">
              <summary>{field}</summary>
              <div className="settings-collection-grid">
                <pre className="admin-pricing-effective">
                  {JSON.stringify((left.data!.meta as unknown as Record<string, unknown>)[field], null, 2) ?? '—'}
                </pre>
                <pre className="admin-pricing-effective">
                  {JSON.stringify((right.data!.meta as unknown as Record<string, unknown>)[field], null, 2) ?? '—'}
                </pre>
              </div>
            </details>
          ))}
          <h3>{t('Source diff')}</h3>
          <SourceDiffView key={`${before}:${after}`} before={left.data.source} after={right.data.source} />
        </>
      )}
    </section>
  )
}
