'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { JsonValueInput } from '@/components/shared/json-value-input'
import { affinityKeyTypes, parseAffinityRules, type AffinityRule } from './lib/affinity-rules'
import { RULE_TEMPLATES, cloneTemplate, makeUniqueName } from './lib/affinity-templates'

function AffinityLines(props: { label: string; value: string[] | null | undefined; onChange: (value: string[]) => void }) {
  const serialized = (props.value || []).join('\n'),
    [draft, setDraft] = useState(serialized)
  useEffect(() => setDraft(serialized), [serialized])
  return (
    <label className="field">
      {props.label}
      <Textarea
        rows={3}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          props.onChange(
            event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
          )
        }}
      />
    </label>
  )
}
function AffinityRuleFields(props: { rule: AffinityRule; onChange: (rule: AffinityRule) => void }) {
  const { t } = useTranslation(),
    rule = props.rule,
    sources = rule.key_sources || []
  function change(key: string, value: unknown) {
    props.onChange({ ...rule, [key]: value })
  }
  return (
    <div className="settings-collection-grid">
      <label className="field">
        {t('Name')}
        <Input required value={rule.name || ''} onChange={(event) => change('name', event.target.value)} />
      </label>
      <label className="field">
        {t('Session mode')}
        <select value={rule.session_mode || ''} onChange={(event) => change('session_mode', event.target.value)}>
          <option value="">{t('Legacy retry behavior')}</option>
          <option value="inherit">{t('Inherit global session mode')}</option>
          {[
            ['off', 'Off'],
            ['prefer', 'Prefer'],
            ['strict', 'Strict'],
          ].map(([mode, label]) => (
            <option key={mode} value={mode}>
              {t(label)}
            </option>
          ))}
        </select>
      </label>
      <AffinityLines label={t('Model patterns (one per line)')} value={rule.model_regex} onChange={(value) => change('model_regex', value)} />
      <AffinityLines label={t('Path patterns (one per line)')} value={rule.path_regex} onChange={(value) => change('path_regex', value)} />
      <AffinityLines
        label={t('User-Agent contains (one per line)')}
        value={rule.user_agent_include}
        onChange={(value) => change('user_agent_include', value)}
      />
      <label className="field">
        {t('Value regex')}
        <Input value={rule.value_regex || ''} onChange={(event) => change('value_regex', event.target.value)} />
      </label>
      <label className="field">
        {t('TTL seconds (0 uses global default)')}
        <Input
          type="number"
          required
          min={0}
          step={1}
          value={rule.ttl_seconds ?? 0}
          onChange={(event) => change('ttl_seconds', event.target.value === '' ? 0 : Number(event.target.value))}
        />
      </label>
      <div className="settings-wide affinity-flags">
        {[
          ['skip_retry_on_failure', 'Skip retry on failure'],
          ['include_using_group', 'Include group in affinity key'],
          ['include_model_name', 'Include model in affinity key'],
          ['include_rule_name', 'Include rule name in affinity key'],
        ].map(([key, label]) => (
          <label key={key} className="checkbox-label">
            <input type="checkbox" checked={rule[key] === true} onChange={(event) => change(key, event.target.checked)} />
            {t(label)}
          </label>
        ))}
      </div>
      <section className="settings-wide settings-collection">
        <strong>{t('Affinity key sources')}</strong>
        {sources.map((source, index) => (
          <div key={index} className="affinity-key-source">
            <label className="field">
              {t('Type')}
              <select
                value={source.type}
                onChange={(event) =>
                  change(
                    'key_sources',
                    sources.map((item, position) => (position === index ? { ...item, type: event.target.value } : item))
                  )
                }
              >
                {affinityKeyTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t(source.type === 'gjson' ? 'JSON path' : 'Source key')}
              <Input
                required
                value={(source.type === 'gjson' ? source.path : source.key) || ''}
                onChange={(event) =>
                  change(
                    'key_sources',
                    sources.map((item, position) =>
                      position === index ? { ...item, [source.type === 'gjson' ? 'path' : 'key']: event.target.value } : item
                    )
                  )
                }
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                change(
                  'key_sources',
                  sources.filter((_, position) => position !== index)
                )
              }
            >
              {t('Remove')}
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => change('key_sources', [...sources, { type: 'request_header', key: '' }])}>
          {t('Add key source')}
        </Button>
      </section>
      <div className="field settings-wide">
        <span>{t('Parameter override template (JSON)')}</span>
        <JsonValueInput
          label={t('Parameter override template (JSON)')}
          objectOnly
          value={rule.param_override_template ?? null}
          onChange={(value) => change('param_override_template', value)}
        />
      </div>
    </div>
  )
}
export function AffinityRulesEditor(props: { id: string; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation(),
    [raw, setRaw] = useState(false),
    rows = parseAffinityRules(props.value)
  function update(value: AffinityRule[]) {
    props.onChange(JSON.stringify(value, null, 2))
  }
  function add(template: string) {
    if (!rows) return
    const rule: AffinityRule = template
      ? cloneTemplate(RULE_TEMPLATES[template])
      : {
          name: 'rule',
          model_regex: [],
          path_regex: [],
          key_sources: [{ type: 'request_header', key: '' }],
          ttl_seconds: 0,
          session_mode: 'inherit',
          skip_retry_on_failure: false,
          include_using_group: true,
          include_model_name: false,
          include_rule_name: true,
        }
    rule.name = makeUniqueName(new Set(rows.map((item) => item.name || '')), rule.name || 'rule')
    update([...rows, rule])
  }
  return (
    <div id={props.id} className="settings-collection affinity-rules-editor">
      <div className="settings-collection-toolbar">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!rows}
          onClick={(event) => {
            const invalid = event.currentTarget.closest('.settings-collection')?.querySelector<HTMLTextAreaElement>('textarea[aria-invalid="true"]')
            if (!invalid || invalid.reportValidity()) setRaw(!raw)
          }}
        >
          {t(raw ? 'Visual editor' : 'Raw JSON')}
        </Button>
        <span className="small-note">{t('Rules are matched in order. Unknown properties are preserved.')}</span>
      </div>
      {raw || !rows ? (
        <Textarea
          rows={10}
          aria-label={t('Affinity rules JSON')}
          className="admin-pricing-expression"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      ) : (
        <>
          {rows.map((rule, index) => (
            <section key={index} className="settings-collection-row">
              <div className="settings-collection-toolbar">
                <strong>{rule.name || t('Rule')}</strong>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!index}
                    onClick={() => {
                      const next = [...rows]
                      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                      update(next)
                    }}
                  >
                    {t('Move up')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === rows.length - 1}
                    onClick={() => {
                      const next = [...rows]
                      ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                      update(next)
                    }}
                  >
                    {t('Move down')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const copy = cloneTemplate(rule)
                      copy.name = makeUniqueName(new Set(rows.map((item) => item.name || '')), rule.name || 'rule')
                      update([...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)])
                    }}
                  >
                    {t('Duplicate rule')}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => update(rows.filter((_, position) => position !== index))}>
                    {t('Remove')}
                  </Button>
                </div>
              </div>
              <AffinityRuleFields rule={rule} onChange={(value) => update(rows.map((item, position) => (position === index ? value : item)))} />
            </section>
          ))}
          <div className="action-buttons">
            <Button type="button" variant="outline" onClick={() => add('')}>
              {t('Add rule')}
            </Button>
            <Button type="button" variant="outline" onClick={() => add('codexCli')}>
              {t('Add Codex CLI template')}
            </Button>
            <Button type="button" variant="outline" onClick={() => add('claudeCli')}>
              {t('Add Claude CLI template')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
