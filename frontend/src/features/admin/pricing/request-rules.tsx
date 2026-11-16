'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buildRequestRuleExpr,
  combineBillingExpr,
  createEmptyRuleGroup,
  createEmptyCondition,
  createEmptyTimeCondition,
  getRequestRuleMatchOptions,
  normalizeCondition,
  TIME_FUNCS,
  type RequestCondition,
  type RequestRuleGroup,
} from '@/features/pricing/lib/billing-expr'
import { pricingExpressionParts, requestRulesDraft, parseRequestRulesDraft } from './visual-draft'

export function RequestRulesEditor({
  value,
  onChange,
  onValidityChange,
  onEditingChange,
}: {
  value: string
  onChange: (value: string) => void
  onValidityChange: (valid: boolean) => void
  onEditingChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<RequestRuleGroup[] | null>(null),
    [invalid, setInvalid] = useState(false),
    [unsupported, setUnsupported] = useState(false)
  function change(next: RequestRuleGroup[]) {
    setGroups(next)
    const result = requestRulesDraft(next)
    setInvalid(!result.ok)
    onValidityChange(result.ok)
    if (result.ok) {
      const parts = pricingExpressionParts(value)
      onChange(parts.prefix + combineBillingExpr(parts.billingExpr, buildRequestRuleExpr(next)))
    }
  }
  function conditionAt(index: number, n: number, condition: RequestCondition) {
    change(
      groups!.map((group, i) => (i === index ? { ...group, conditions: group.conditions.map((item, j) => (j === n ? condition : item)) } : group))
    )
  }
  return (
    <section className="pricing-rules">
      <Button
        type="button"
        variant="outline"
        aria-expanded={groups !== null}
        onClick={() => {
          if (groups !== null) {
            setGroups(null)
            setInvalid(false)
            onValidityChange(true)
            onEditingChange(false)
            return
          }
          const parsed = parseRequestRulesDraft(pricingExpressionParts(value).requestRuleExpr)
          setUnsupported(parsed === null)
          setGroups(parsed)
          onEditingChange(parsed !== null)
        }}
      >
        {t('Request multipliers')}
      </Button>
      {unsupported && <p className="small-note">{t('This expression cannot be edited visually without losing information.')}</p>}
      {groups !== null && (
        <>
          <p className="small-note">{t('Conditions in a rule use AND. Matching rules multiply together; unmatched rules use 1.')}</p>
          {groups.map((group, index) => (
            <fieldset className="pricing-tier" key={index}>
              <legend>
                {t('Rule')} {index + 1}
              </legend>
              {group.conditions.map((condition, n) => (
                <div className="pricing-condition-row" key={n}>
                  <label className="field">
                    <span>{t('Source')}</span>
                    <select
                      value={condition.source}
                      onChange={(event) =>
                        conditionAt(
                          index,
                          n,
                          event.target.value === 'time'
                            ? createEmptyTimeCondition()
                            : { ...createEmptyCondition(), source: event.target.value as 'param' | 'header' }
                        )
                      }
                    >
                      <option value="param">{t('Request body')}</option>
                      <option value="header">{t('Request headers')}</option>
                      <option value="time">{t('Time')}</option>
                    </select>
                  </label>
                  {condition.source === 'time' ? (
                    <>
                      <label className="field">
                        <span>{t('Condition variable')}</span>
                        <select
                          value={condition.timeFunc}
                          onChange={(event) => conditionAt(index, n, { ...condition, timeFunc: event.target.value as typeof condition.timeFunc })}
                        >
                          {TIME_FUNCS.map((fn) => (
                            <option key={fn}>{fn}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>{t('Timezone')}</span>
                        <Input
                          value={condition.timezone}
                          onChange={(event) => conditionAt(index, n, { ...condition, timezone: event.target.value })}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="field">
                      <span>{t('Path or header name')}</span>
                      <Input value={condition.path} onChange={(event) => conditionAt(index, n, { ...condition, path: event.target.value })} />
                    </label>
                  )}
                  <label className="field">
                    <span>{t('Comparison')}</span>
                    <select
                      value={condition.mode}
                      onChange={(event) => conditionAt(index, n, normalizeCondition({ ...condition, mode: event.target.value }))}
                    >
                      {getRequestRuleMatchOptions(condition.source).map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {condition.source !== 'time' && condition.mode === 'eq' && (
                    <label className="field">
                      <span>{t('Value type')}</span>
                      <select
                        value={condition.valueType || 'auto'}
                        onChange={(event) => conditionAt(index, n, { ...condition, valueType: event.target.value as typeof condition.valueType })}
                      >
                        <option value="auto">{t('Auto')}</option>
                        <option value="string">{t('String value')}</option>
                        <option value="number">{t('Number')}</option>
                        <option value="boolean">{t('Boolean')}</option>
                      </select>
                    </label>
                  )}
                  {condition.source === 'time' && condition.mode === 'range' ? (
                    <>
                      {(['rangeStart', 'rangeEnd'] as const).map((key) => (
                        <label className="field" key={key}>
                          <span>{t(key === 'rangeStart' ? 'Range start' : 'Range end (exclusive)')}</span>
                          <Input
                            type="number"
                            step={1}
                            value={condition[key]}
                            onChange={(event) => conditionAt(index, n, { ...condition, [key]: event.target.value })}
                          />
                        </label>
                      ))}
                    </>
                  ) : (
                    condition.mode !== 'exists' && (
                      <label className="field">
                        <span>{t('Condition value')}</span>
                        <Input value={condition.value} onChange={(event) => conditionAt(index, n, { ...condition, value: event.target.value })} />
                      </label>
                    )
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      change(groups.map((item, i) => (i === index ? { ...item, conditions: item.conditions.filter((_, j) => j !== n) } : item)))
                    }
                  >
                    {t('Remove condition')}
                  </Button>
                </div>
              ))}
              <div className="pricing-group-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    change(groups.map((item, i) => (i === index ? { ...item, conditions: [...item.conditions, createEmptyCondition()] } : item)))
                  }
                >
                  {t('Add condition')}
                </Button>
                <label className="field">
                  <span>{t('Multiplier')}</span>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={group.multiplier}
                    onChange={(event) => change(groups.map((item, i) => (i === index ? { ...item, multiplier: event.target.value } : item)))}
                  />
                </label>
                <Button type="button" variant="ghost" onClick={() => change(groups.filter((_, i) => i !== index))}>
                  {t('Remove rule')}
                </Button>
              </div>
            </fieldset>
          ))}
          <Button type="button" variant="outline" onClick={() => change([...groups, createEmptyRuleGroup()])}>
            {t('Add rule')}
          </Button>
          {invalid && <p role="alert">{t('Complete every rule with valid conditions and a finite non-negative multiplier.')}</p>}
        </>
      )}
    </section>
  )
}
