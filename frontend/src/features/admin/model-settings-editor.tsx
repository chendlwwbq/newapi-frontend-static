'use client'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingList } from './setting-list'
import { Textarea } from '@/components/ui/textarea'
import { modelListKeys, modelMappingRecord, parseModelSetting, safetyThresholds } from './lib/model-settings-editor'

type MappingKind = 'headers' | 'header-values' | 'tokens' | 'price' | 'safety' | 'version'
function ModelMapping(props: { value: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void; kind: MappingKind }) {
  const { t } = useTranslation(),
    nextId = useRef(Object.keys(props.value).length)
  const [rows, setRows] = useState(() => Object.entries(props.value).map(([name, value], id) => ({ name, value, id })))
  let nameLabel = 'Model pattern',
    addLabel = 'Add model mapping'
  if (props.kind === 'header-values') {
    nameLabel = 'Header name'
    addLabel = 'Add header'
  }
  if (props.kind === 'price') {
    nameLabel = 'Tool identifier'
    addLabel = 'Add tool price override'
  }
  const valid = modelMappingRecord(rows.map((row) => [row.name, row.value])),
    names = rows.map((row) => row.name)
  function update(next: typeof rows) {
    setRows(next)
    const record = modelMappingRecord(next.map((row) => [row.name, row.value]))
    if (record) props.onChange(record)
  }
  return (
    <div className="model-setting-mapping">
      {rows.map(({ name, value, id }, index) => {
        const duplicate = names.indexOf(name) !== names.lastIndexOf(name)
        return (
          <section className="model-setting-row grid grid-cols-1 gap-4 rounded-xl border border-border/60 p-4 md:grid-cols-2" key={id}>
            <div className="model-setting-item">
              <label className="field">
                {t(nameLabel)}
                <Input
                  aria-label={t(nameLabel)}
                  required
                  value={name}
                  aria-invalid={duplicate || !name.trim()}
                  ref={(element) => {
                    element?.setCustomValidity(duplicate || !name.trim() ? t('Names must be nonempty and unique.') : '')
                  }}
                  onChange={(event) => update(rows.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))}
                />
              </label>
              <Button type="button" size="sm" variant="ghost" onClick={() => update(rows.filter((_, i) => i !== index))}>
                {t('Remove')}
              </Button>
            </div>
            <ModelMappingValue
              kind={props.kind}
              value={value}
              onChange={(next) => update(rows.map((row, i) => (i === index ? { ...row, value: next } : row)))}
            />
          </section>
        )
      })}
      {!valid && (
        <p className="inline-error" role="alert">
          {t('Names must be nonempty and unique.')}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          let initial: unknown = ''
          if (props.kind === 'headers') initial = {}
          if (props.kind === 'header-values') initial = []
          if (props.kind === 'tokens' || props.kind === 'price') initial = 0
          update([...rows, { id: nextId.current++, name: '', value: initial }])
        }}
      >
        {t(addLabel)}
      </Button>
    </div>
  )
}

function ModelMappingValue(props: { kind: MappingKind; value: unknown; onChange: (value: unknown) => void }) {
  const { t } = useTranslation()
  if (props.kind === 'headers') return <ModelMapping value={props.value as Record<string, unknown>} kind="header-values" onChange={props.onChange} />
  if (props.kind === 'header-values') return <SettingList label={t('Header value')} value={props.value as string[]} onChange={props.onChange} />
  if (props.kind === 'safety')
    return (
      <label className="field">
        {t('Safety threshold')}
        <select aria-label={t('Safety threshold')} value={String(props.value)} onChange={(event) => props.onChange(event.target.value)}>
          {safetyThresholds.map((threshold) => (
            <option key={threshold} value={threshold}>
              {threshold || t('Default')}
            </option>
          ))}
        </select>
      </label>
    )
  if (props.kind === 'price')
    return (
      <label className="field">
        {t('Price ($/1K calls)')}
        <Input
          aria-label={t('Price ($/1K calls)')}
          type="number"
          min={0}
          step="any"
          required
          value={String(props.value)}
          onChange={(event) => props.onChange(event.target.value === '' ? '' : Number(event.target.value))}
        />
      </label>
    )
  return (
    <label className="field">
      {t(props.kind === 'tokens' ? 'Default Max Tokens' : 'API version')}
      <Input
        aria-label={t(props.kind === 'tokens' ? 'Default Max Tokens' : 'API version')}
        type={props.kind === 'tokens' ? 'number' : 'text'}
        min={0}
        step={1}
        required={props.kind === 'tokens'}
        value={String(props.value)}
        onChange={(event) => props.onChange(props.kind === 'tokens' && event.target.value !== '' ? Number(event.target.value) : event.target.value)}
      />
    </label>
  )
}

function ConversionPolicy(props: { value: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  const { t } = useTranslation()
  return (
    <div className="model-setting-policy">
      {(
        [
          ['enabled', 'Enabled'],
          ['all_channels', 'All channels'],
        ] as const
      ).map(([key, label]) => (
        <label className="checkbox-label" key={key}>
          <input
            type="checkbox"
            checked={props.value[key] === true}
            onChange={(event) => props.onChange({ ...props.value, [key]: event.target.checked })}
          />
          {t(label)}
        </label>
      ))}
      <p className="small-note">
        {t('Channel IDs and channel types are alternatives. All channels bypasses both lists. Model patterns use Go regular expressions.')}
      </p>
      {(
        [
          ['channel_ids', 'Channel IDs'],
          ['channel_types', 'Channel type IDs'],
          ['model_patterns', 'Model patterns'],
        ] as const
      ).map(([key, label]) => (
        <section key={key}>
          <h4>{t(label)}</h4>
          <SettingList
            label={t(label)}
            numeric={key !== 'model_patterns'}
            value={(props.value[key] as (string | number)[]) || []}
            onChange={(next) => props.onChange({ ...props.value, [key]: next })}
          />
        </section>
      ))}
    </div>
  )
}

export function ModelSettingsEditor(props: { optionKey: string; value: string; onChange: (next: string) => void; id: string }) {
  const { t } = useTranslation(),
    [raw, setRaw] = useState(false),
    root = useRef<HTMLDivElement>(null)
  const parsed = parseModelSetting(props.optionKey, props.value)
  function update(value: unknown) {
    props.onChange(JSON.stringify(value, null, 2))
  }
  let kind: MappingKind = 'version'
  if (props.optionKey === 'claude.model_headers_settings') kind = 'headers'
  if (props.optionKey === 'claude.default_max_tokens') kind = 'tokens'
  if (props.optionKey === 'tool_price_setting.prices') kind = 'price'
  if (props.optionKey === 'gemini.safety_settings') kind = 'safety'
  let content
  if (raw || parsed === null)
    content = <Textarea rows={8} aria-label={t('Raw JSON')} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
  else if (modelListKeys.has(props.optionKey)) content = <SettingList label={t('Model identifier')} value={parsed as string[]} onChange={update} />
  else if (props.optionKey === 'global.chat_completions_to_responses_policy')
    content = <ConversionPolicy value={parsed as Record<string, unknown>} onChange={update} />
  else content = <ModelMapping value={parsed as Record<string, unknown>} kind={kind} onChange={update} />
  return (
    <div className="settings-collection model-settings-editor" id={props.id} ref={root}>
      <div className="settings-collection-toolbar">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={parsed === null}
          onClick={() => {
            const invalid = root.current?.querySelector<HTMLInputElement>('input:invalid')
            if (invalid) {
              invalid.reportValidity()
              return
            }
            setRaw((previous) => !previous)
          }}
        >
          {t(raw || parsed === null ? 'Visual editor' : 'Raw JSON')}
        </Button>
        <small className="small-note">{t('Unknown properties are preserved.')}</small>
      </div>
      {content}
    </div>
  )
}
