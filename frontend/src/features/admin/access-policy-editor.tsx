'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { JsonValueInput } from '@/components/shared/json-value-input'
import { parseAccessPolicy, policyOperators, policyTemplates, type AccessPolicy } from './lib/access-policy'

function PolicyGroup(props: { value: AccessPolicy; onChange: (value: AccessPolicy) => void }) {
  const { t } = useTranslation(),
    policy = props.value
  const conditions = policy.conditions || [],
    groups = policy.groups || []
  return (
    <section className="policy-group">
      <label className="field">
        {t('Match conditions')}
        <select value={policy.logic?.trim().toLowerCase() || 'and'} onChange={(event) => props.onChange({ ...policy, logic: event.target.value })}>
          <option value="and">{t('All conditions (AND)')}</option>
          <option value="or">{t('Any condition (OR)')}</option>
        </select>
      </label>
      {conditions.map((condition, index) => (
        <div className="policy-condition" key={index}>
          <label className="field">
            {t('User info field')}
            <Input
              required
              value={condition.field}
              placeholder="email_verified"
              onChange={(event) =>
                props.onChange({
                  ...policy,
                  conditions: conditions.map((item, position) => (position === index ? { ...item, field: event.target.value } : item)),
                })
              }
            />
          </label>
          <label className="field">
            {t('Comparison operator')}
            <select
              value={condition.op.trim().toLowerCase()}
              onChange={(event) =>
                props.onChange({
                  ...policy,
                  conditions: conditions.map((item, position) => (position === index ? { ...item, op: event.target.value } : item)),
                })
              }
            >
              {policyOperators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>
          {!['exists', 'not_exists'].includes(condition.op.trim().toLowerCase()) && (
            <div className="field">
              <span>{t('Value (JSON)')}</span>
              <JsonValueInput
                label={t('Value (JSON)')}
                value={condition.value}
                onChange={(value) =>
                  props.onChange({ ...policy, conditions: conditions.map((item, position) => (position === index ? { ...item, value } : item)) })
                }
              />
            </div>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => props.onChange({ ...policy, conditions: conditions.filter((_, position) => position !== index) })}
          >
            {t('Remove condition')}
          </Button>
        </div>
      ))}
      {groups.map((group, index) => (
        <div key={index} className="policy-nested">
          <PolicyGroup
            value={group}
            onChange={(value) => props.onChange({ ...policy, groups: groups.map((item, position) => (position === index ? value : item)) })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => props.onChange({ ...policy, groups: groups.filter((_, position) => position !== index) })}
          >
            {t('Remove group')}
          </Button>
        </div>
      ))}
      {!conditions.length && !groups.length && <p className="small-note">{t('Add at least one condition or group before saving.')}</p>}
      <div className="action-buttons">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => props.onChange({ ...policy, conditions: [...conditions, { field: '', op: 'eq', value: '' }] })}
        >
          {t('Add condition')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => props.onChange({ ...policy, groups: [...groups, { logic: 'and', conditions: [{ field: '', op: 'eq', value: '' }] }] })}
        >
          {t('Add group')}
        </Button>
      </div>
    </section>
  )
}
export function AccessPolicyEditor(props: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation(),
    [raw, setRaw] = useState(false),
    [template, setTemplate] = useState('verifiedEmail')
  const policy = parseAccessPolicy(props.value),
    empty = !props.value.trim()
  return (
    <div className="settings-collection access-policy-editor">
      <div className="settings-collection-toolbar">
        <strong>{t('Access Policy')}</strong>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!empty && !policy}
          onClick={(event) => {
            const invalid = event.currentTarget.closest('.settings-collection')?.querySelector<HTMLTextAreaElement>('textarea[aria-invalid="true"]')
            if (!invalid || invalid.reportValidity()) setRaw(!raw)
          }}
        >
          {t(raw ? 'Visual editor' : 'Raw JSON')}
        </Button>
      </div>
      <p className="small-note">{t('The server evaluates this policy against provider user info. JSON values keep their original types.')}</p>
      {raw || (!empty && !policy) ? (
        <Textarea
          aria-label={t('Access Policy')}
          rows={8}
          value={props.value}
          className="admin-pricing-expression"
          onChange={(event) => props.onChange(event.target.value)}
        />
      ) : (
        <>
          {policy && <PolicyGroup value={policy} onChange={(value) => props.onChange(JSON.stringify(value, null, 2))} />}
          {empty && <p className="small-note">{t('No access policy configured')}</p>}
          <div className="settings-collection-toolbar">
            <label className="field">
              {t('Policy template')}
              <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                <option value="verifiedEmail">{t('Verified email')}</option>
                <option value="levelAndActive">{t('Level and active status')}</option>
                <option value="orgOrRole">{t('Organization or role')}</option>
              </select>
            </label>
            <Button type="button" variant="outline" onClick={() => props.onChange(JSON.stringify(policyTemplates[template], null, 2))}>
              {t('Apply template')}
            </Button>
            {!empty && (
              <Button type="button" variant="ghost" onClick={() => props.onChange('')}>
                {t('Clear policy')}
              </Button>
            )}
          </div>
        </>
      )}
      <small className="small-note">{t('Unknown properties are preserved.')}</small>
    </div>
  )
}
