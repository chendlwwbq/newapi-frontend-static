'use client'
import Link from 'next/link'
import { Fragment, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createCurrencyFormatter, parseCurrencyDisplayType } from '@/lib/currency'
import { toIntlLocale } from '@/i18n/languages'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { settingsSections } from './settings-schema'
import { prepareOptionChanges, projectOptionValues } from './lib/settings-options'
import { SettingsNav } from './settings-nav'
import { PasskeyDomains } from './passkey-domains'
import { CustomOAuthProviders } from './custom-oauth-providers'
import { GroupSettings } from './pricing/group-settings'
import { OAuthCallbacks } from './oauth-callbacks'
import { PaymentCompliance, paymentComplianceConfirmed } from './payment-compliance'
import { PancakeSettings } from './pancake-settings'
import { AffinityRulesEditor } from './affinity-rules-editor'
import { ModelSettingsEditor } from './model-settings-editor'
import { modelEditorKeys } from './lib/model-settings-editor'
import { SettingsCollectionEditor } from './settings-collection-editor'
import { RateLimitsEditor } from './rate-limits-editor'
import { NavigationEditor } from './navigation-editor'
import { ContentPreview } from '@/components/shared/content-preview'
import { SettingsDraftGuard } from './settings-draft-guard'
import { VideoStoragePanel } from './video-storage-panel'

function SettingsForm({ section, initial, disabled = false }: { section: string; initial: Record<string, string>; disabled?: boolean }) {
  const { t, i18n } = useTranslation()
  const queries = useQueryClient()
  const config = settingsSections[section]
  const { fields, mode } = config
  const [baseline, setBaseline] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const [cleared, setCleared] = useState<Set<string>>(() => new Set())
  const dirty = fields.filter((field) => cleared.has(field.key) || draft[field.key] !== baseline[field.key])
  const quota = createCurrencyFormatter({
    displayInCurrency: draft['general_setting.quota_display_type'] !== 'TOKENS',
    quotaDisplayType: parseCurrencyDisplayType(draft['general_setting.quota_display_type']),
    quotaPerUnit: Number(draft.QuotaPerUnit),
    usdExchangeRate: Number(draft.USDExchangeRate),
    customCurrencySymbol: draft['general_setting.custom_currency_symbol'],
    customCurrencyExchangeRate: Number(draft['general_setting.custom_currency_exchange_rate']),
  })
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      const changes = prepareOptionChanges(config, baseline, draft, cleared)
      setBusy(true)
      if (mode === 'policy') {
        const result = await api<{ options: Record<string, string> }>('/api/option/request_policy', {
          method: 'PATCH',
          body: { options: Object.fromEntries(changes.map((change) => [change.key, String(change.value)])) },
        })
        setBaseline(result.options)
        setDraft(result.options)
        setJustSaved(true)
        toast.success(t('Saved'))
        return
      }
      // Settle each successful native write immediately; failed later writes
      // stay dirty. Submitted credentials are removed from component state.
      for (const change of changes) {
        await api('/api/option', { method: 'PUT', body: change })
        const field = fields.find((field) => field.key === change.key)!
        const value = field.writeOnly ? '' : field.kind === 'domains' ? String(change.value).split(',').join('\n') : String(change.value)
        setBaseline((previous) => ({ ...previous, [change.key]: value }))
        setDraft((previous) => ({ ...previous, [change.key]: value }))
        setCleared((previous) => {
          const next = new Set(previous)
          next.delete(change.key)
          return next
        })
      }
      setJustSaved(true)
      toast.success(t('Saved'))
    } catch (error) {
      toast.error(t((error as Error).message))
    } finally {
      setBusy(false)
      for (const key of [
        'system-options',
        'status',
        'performance',
        'channel-ops-policy',
        'uptime',
        'wallet',
        'topup-info',
        'pricing',
        'catalog',
        'catalog-model',
        'catalog-notices',
        'rankings',
      ])
        void queries.invalidateQueries({ queryKey: [key] })
    }
  }
  return (
    <form onSubmit={save} autoComplete="off">
      <SettingsDraftGuard active={['site', 'content', 'news'].includes(section) && dirty.length > 0} busy={busy} />
      <fieldset className="admin-pricing-fields settings-fields" disabled={busy || disabled}>
        {fields.map((field) => {
          const id = `setting-${field.key}`
          return (
            <Fragment key={field.key}>
              {field.group && <h2 className="settings-group-title">{t(field.group)}</h2>}
              <div className={`field ${field.kind === 'boolean' ? 'settings-toggle' : ''}`}>
                <label htmlFor={id}>
                  {t(field.label)}
                  {(cleared.has(field.key) || draft[field.key] !== baseline[field.key]) && (
                    <span className="settings-dirty" aria-label={t('Unsaved changes')}>
                      {' '}
                      ●
                    </span>
                  )}
                </label>
                {field.kind === 'boolean' ? (
                  <input
                    id={id}
                    type="checkbox"
                    checked={draft[field.key] === 'true'}
                    onChange={(event) => setDraft((previous) => ({ ...previous, [field.key]: String(event.target.checked) }))}
                  />
                ) : field.kind === 'select' ? (
                  <select
                    id={id}
                    value={draft[field.key]}
                    onChange={(event) => setDraft((previous) => ({ ...previous, [field.key]: event.target.value }))}
                  >
                    {field.choices?.map(([value, label]) => (
                      <option value={value} key={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                ) : ['HeaderNavModules', 'SidebarModulesAdmin'].includes(field.key) ? (
                  <NavigationEditor
                    optionKey={field.key}
                    value={draft[field.key]}
                    onChange={(value) => setDraft((previous) => ({ ...previous, [field.key]: value }))}
                  />
                ) : field.key === 'ModelRequestRateLimitGroup' ? (
                  <RateLimitsEditor value={draft[field.key]} onChange={(value) => setDraft((previous) => ({ ...previous, [field.key]: value }))} />
                ) : field.key === 'channel_affinity_setting.rules' ? (
                  <AffinityRulesEditor
                    key={resetVersion}
                    id={id}
                    value={draft[field.key]}
                    onChange={(value) => setDraft((previous) => ({ ...previous, [field.key]: value }))}
                  />
                ) : modelEditorKeys.has(field.key) ? (
                  <ModelSettingsEditor
                    key={`${field.key}:${resetVersion}`}
                    id={id}
                    optionKey={field.key}
                    value={draft[field.key]}
                    onChange={(value) => setDraft((previous) => ({ ...previous, [field.key]: value }))}
                  />
                ) : field.kind === 'json' ? (
                  <SettingsCollectionEditor
                    id={id}
                    optionKey={field.key}
                    value={draft[field.key]}
                    onChange={(value) => setDraft((previous) => ({ ...previous, [field.key]: value }))}
                  />
                ) : ['textarea', 'domains'].includes(field.kind || '') ? (
                  <Textarea
                    id={id}
                    rows={5}
                    value={draft[field.key]}
                    onChange={(event) => setDraft((previous) => ({ ...previous, [field.key]: event.target.value }))}
                  />
                ) : (
                  <Input
                    id={id}
                    type={field.kind === 'number' ? 'number' : field.kind === 'secret' ? 'password' : 'text'}
                    autoComplete={field.writeOnly ? 'new-password' : 'off'}
                    disabled={cleared.has(field.key)}
                    min={field.min ?? field.exclusiveMin}
                    max={field.max}
                    step={field.kind === 'number' ? field.step || 1 : undefined}
                    required={field.kind === 'number'}
                    value={draft[field.key]}
                    onChange={(event) => setDraft((previous) => ({ ...previous, [field.key]: event.target.value }))}
                  />
                )}
                {field.writeOnly && (
                  <>
                    <small className="small-note">{t('Leave blank to keep the stored value.')}</small>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={cleared.has(field.key)}
                        onChange={(event) => {
                          const clear = event.target.checked
                          setCleared((previous) => {
                            const next = new Set(previous)
                            if (clear) next.add(field.key)
                            else next.delete(field.key)
                            return next
                          })
                          if (clear) setDraft((previous) => ({ ...previous, [field.key]: '' }))
                        }}
                      />
                      {t('Clear stored value')}
                    </label>
                  </>
                )}
                {field.hint && !field.hint.startsWith('[') && <small className="small-note">{t(field.hint)}</small>}
                {section === 'site' && field.kind === 'textarea' && (
                  <ContentPreview source={draft[field.key]} allowFrameURL={field.key === 'HomePageContent'} />
                )}
                {section === 'quota' && field.key.startsWith('QuotaFor') && (
                  <small className="small-note">
                    {t('Draft display value')}:{' '}
                    {Number(draft.QuotaPerUnit) > 0 && Number.isSafeInteger(Number(draft[field.key]))
                      ? quota.formatQuotaWithCurrency(Number(draft[field.key]), { locale: toIntlLocale(i18n.language) })
                      : '—'}
                  </small>
                )}
              </div>
            </Fragment>
          )
        })}
        <div className="settings-save">
          <span className="small-note">
            {dirty.length > 0 ? (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {t('Changed fields')}: {dirty.length}
              </span>
            ) : justSaved ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{t('Saved')}</span>
            ) : (
              `${t('Changed fields')}: 0`
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!dirty.length && !['request-policies', 'models', 'tool-prices'].includes(section)}
            onClick={() => {
              setDraft(baseline)
              setCleared(new Set())
              setResetVersion((previous) => previous + 1)
            }}
          >
            {t('Reset')}
          </Button>
          <Button type="submit" disabled={!dirty.length}>
            {t(busy ? 'Loading' : 'Save')}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
export function SystemSettings({ section }: { section: string }) {
  const { t } = useTranslation()
  const { bundle } = useAuth()
  const root = bundle?.user.role === 100
  const config = settingsSections[section]
  const query = useQuery({
    queryKey: ['system-options', bundle?.user.id, config.mode || 'options'],
    enabled: root,
    queryFn: async ({ signal }) => {
      if (config.mode === 'policy') return (await api<{ options: Record<string, string> }>('/api/option/request_policy', { signal })).options
      return projectOptionValues(await api<{ key: string; value: string }[]>('/api/option', { signal }), settingsSections)
    },
  })
  if (!root) return <EmptyState title={t('Unauthorized, insufficient privileges')} />
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t(config.title)}</h1>
          <p>{t('Save site content and gateway runtime configuration.')}</p>
        </div>
      </div>
      <SettingsNav section={section} />
      {section === 'request-policies' && (
        <p className="small-note">
          <Link href="/ops/affinity-cache">{t('Affinity cache')} →</Link>
        </p>
      )}
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : (
        <section className="console-panel">
          {section === 'email' && (
            <p className="small-note">
              {t('Resend API key')}: {t(query.data.ResendKeyConfigured === 'true' ? 'Configured' : 'Not configured')}
            </p>
          )}
          {section === 'oauth' && <OAuthCallbacks serverAddress={query.data.ServerAddress || ''} />}
          {['payment', 'quota'].includes(section) && <PaymentCompliance values={query.data} />}
          {section === 'video-storage' ? (
            <VideoStoragePanel />
          ) : section === 'groups' ? (
            <GroupSettings
              key={`${bundle?.user.id}:${bundle?.session.sid}`}
              initial={Object.fromEntries(config.fields.map((field) => [field.key, query.data[field.key] ?? field.defaultValue ?? '']))}
            />
          ) : section === 'custom-oauth' ? (
            <CustomOAuthProviders key={`${bundle?.user.id}:${bundle?.session.sid}`} />
          ) : (
            <SettingsForm
              key={`${bundle?.user.id}:${bundle?.session.sid}:${section}`}
              section={section}
              disabled={section === 'payment' && !paymentComplianceConfirmed(query.data)}
              initial={Object.fromEntries(
                config.fields.map((field) => {
                  const value = field.writeOnly ? '' : (query.data[field.key] ?? field.defaultValue ?? '')
                  return [field.key, field.kind === 'domains' ? value.split(',').join('\n') : value]
                })
              )}
            />
          )}
          {section === 'payment' && (
            <PancakeSettings
              key={`${bundle?.user.id}:${bundle?.session.sid}`}
              initial={query.data}
              disabled={!paymentComplianceConfirmed(query.data)}
            />
          )}
          {section === 'passkey' && <PasskeyDomains key={`${bundle?.user.id}:${bundle?.session.sid}`} initial={query.data} />}
        </section>
      )}
    </>
  )
}
