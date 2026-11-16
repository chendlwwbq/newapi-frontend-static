'use client'
import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState } from '@/components/shared/states'
import { groupFields, validateGroupSetting } from './contracts'

function GroupMap({
  value,
  kind,
  onChange,
}: {
  value: Record<string, unknown>
  kind: 'number' | 'string' | 'ratios' | 'visibility'
  onChange: (value: Record<string, unknown>) => void
}) {
  const { t } = useTranslation(),
    [name, setName] = useState('')
  return (
    <div className="pricing-group-map">
      {Object.entries(value).map(([key, item]) => (
        <div className="pricing-group-row" key={key}>
          <strong>{key}</strong>
          {kind === 'ratios' || kind === 'visibility' ? (
            <GroupMap
              value={item as Record<string, unknown>}
              kind={kind === 'ratios' ? 'number' : 'string'}
              onChange={(next) => onChange({ ...value, [key]: next })}
            />
          ) : (
            <Input
              aria-label={key}
              type={kind === 'number' ? 'number' : 'text'}
              min={0}
              step={kind === 'number' ? 'any' : undefined}
              value={item === null ? '' : String(item)}
              onChange={(event) =>
                onChange({
                  ...value,
                  [key]: kind === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value,
                })
              }
            />
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const next = { ...value }
              delete next[key]
              onChange(next)
            }}
          >
            {t('Remove')}
          </Button>
        </div>
      ))}
      <div className="pricing-condition-row">
        <Input
          aria-label={t('Group name')}
          placeholder={kind === 'visibility' ? '+:vip / -:vip' : t('Group name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!name.trim() || Object.hasOwn(value, name.trim())}
          onClick={() => {
            onChange({ ...value, [name.trim()]: kind === 'number' ? 1 : kind === 'string' ? '' : {} })
            setName('')
          }}
        >
          {t('Add')}
        </Button>
      </div>
    </div>
  )
}

export function GroupSettings({ initial }: { initial: Record<string, string> }) {
  const { t } = useTranslation(),
    queries = useQueryClient()
  const [baseline, setBaseline] = useState(initial),
    [draft, setDraft] = useState(initial),
    [json, setJson] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null)
  const keys = [...Object.keys(groupFields), 'MaxTokenAutoGroups', 'DefaultUseAutoGroup'],
    dirty = keys.filter((key) => draft[key] !== baseline[key])
  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const changes = dirty.map((key) => ({ key, value: validateGroupSetting(key, draft[key]) }))
      setBusy(true)
      const latest = Object.fromEntries((await api<{ key: string; value: string }[]>('/api/option')).map((row) => [row.key, row.value]))
      if (changes.some((change) => latest[change.key] !== undefined && latest[change.key] !== baseline[change.key]))
        throw new Error('Group settings changed on the server. Reload before saving.')
      for (const change of changes) {
        await api('/api/option', {
          method: 'PUT',
          body: {
            key: change.key,
            value:
              change.key === 'DefaultUseAutoGroup'
                ? change.value === 'true'
                : change.key === 'MaxTokenAutoGroups'
                  ? Number(change.value)
                  : change.value,
          },
        })
        setBaseline((previous) => ({ ...previous, [change.key]: change.value }))
        setDraft((previous) => ({ ...previous, [change.key]: change.value }))
      }
      toast.success(t('Saved'))
    } catch (failure) {
      setError(failure as Error)
    } finally {
      setBusy(false)
      for (const key of ['system-options', 'pricing', 'catalog', 'catalog-model', 'user-groups', 'playground-groups'])
        void queries.invalidateQueries({ queryKey: [key] })
    }
  }
  return (
    <form onSubmit={save}>
      <fieldset className="plugin-form" disabled={busy}>
        <div className="action-buttons">
          <Button type="button" variant="outline" onClick={() => setJson((value) => !value)}>
            {t(json ? 'Switch to Visual' : 'Switch to JSON')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              const records = await api<{ key: string; value: string }[]>('/api/option').catch((failure) => {
                setError(failure)
                return null
              })
              if (!records) return
              const next = { ...initial, ...Object.fromEntries(records.filter((row) => keys.includes(row.key)).map((row) => [row.key, row.value])) }
              setBaseline(next)
              setDraft(next)
              setError(null)
            }}
          >
            {t('Reload')}
          </Button>
        </div>
        <p className="small-note">
          {t('Group prices multiply model prices. User-group overrides replace the target group ratio. Recharge ratios only affect top-ups.')}
        </p>
        {Object.entries(groupFields).map(([key, label]) => {
          let parsed: unknown,
            parseError = false
          try {
            parsed = JSON.parse(draft[key])
            if (key === 'AutoGroups') parseError = !Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')
            else if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parseError = true
            else if (key === 'GroupGroupRatio' || key === 'group_ratio_setting.group_special_usable_group')
              parseError = Object.values(parsed).some((item) => !item || typeof item !== 'object' || Array.isArray(item))
          } catch {
            parseError = true
          }
          return (
            <section className="pricing-tier" key={key}>
              <h3>{t(label)}</h3>
              {json || parseError ? (
                <label className="field">
                  <span>{t(label)}</span>
                  <Textarea
                    className="admin-pricing-expression"
                    rows={5}
                    spellCheck={false}
                    value={draft[key]}
                    onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))}
                  />
                </label>
              ) : key === 'AutoGroups' ? (
                <label className="field">
                  <span>{t('One group per line, in routing order.')}</span>
                  <Textarea
                    rows={4}
                    value={(parsed as string[]).join('\n')}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        [key]: JSON.stringify(event.target.value === '' ? [] : event.target.value.split('\n')),
                      }))
                    }
                  />
                </label>
              ) : (
                <GroupMap
                  value={parsed as Record<string, unknown>}
                  kind={
                    key === 'UserUsableGroups'
                      ? 'string'
                      : key === 'GroupGroupRatio'
                        ? 'ratios'
                        : key === 'group_ratio_setting.group_special_usable_group'
                          ? 'visibility'
                          : 'number'
                  }
                  onChange={(value) => setDraft((previous) => ({ ...previous, [key]: JSON.stringify(value) }))}
                />
              )}
              {key === 'group_ratio_setting.group_special_usable_group' && (
                <p className="small-note">{t('Add visibility with +:group or hide with -:group. Values are display descriptions.')}</p>
              )}
            </section>
          )
        })}
        <label className="field">
          <span>{t('Maximum automatic groups per token')}</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={draft.MaxTokenAutoGroups}
            onChange={(event) => setDraft((previous) => ({ ...previous, MaxTokenAutoGroups: event.target.value }))}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.DefaultUseAutoGroup === 'true'}
            onChange={(event) => setDraft((previous) => ({ ...previous, DefaultUseAutoGroup: String(event.target.checked) }))}
          />
          {t('Use automatic group by default')}
        </label>
        <p className="small-note">{t('Settings save individually. Successful fields remain saved if a later field fails.')}</p>
        {error && <ErrorState error={error} />}
        <details className="admin-advanced">
          <summary>
            {t('Review changes')} · {dirty.length}
          </summary>
          {dirty.map((key) => (
            <div key={key}>
              <strong>{key}</strong>
              <pre className="admin-pricing-effective">
                {baseline[key]} → {draft[key]}
              </pre>
            </div>
          ))}
        </details>
        <div className="settings-save">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty.length}
            onClick={() => {
              setDraft(baseline)
              setError(null)
            }}
          >
            {t('Reset')}
          </Button>
          <Button type="submit" disabled={!dirty.length}>
            {t('Save group settings')}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
