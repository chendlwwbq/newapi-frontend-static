'use client'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RequestRulesEditor } from './request-rules'
import { PriceSimulation } from '@/features/pricing/price-simulation'
import { BILLING_PRICING_VARS } from '@/features/pricing/lib/billing-expr'
import { pricingExpressionParts, combinePricingDraft, taskVisualDraft, setVisualImageCount, isRequestPricingTree } from './visual-draft'
import { TOKEN_VARIABLES, TIME_FUNCTIONS } from '@/features/pricing/lib/billing-expression/types'
import {
  parseVisualBillingDocument,
  serializeVisualBillingDocument,
  visualNodeId,
  type VisualBillingDocument,
  type VisualPricingNode,
  type VisualCondition,
} from '@/features/pricing/lib/billing-expression/visual'
import {
  createDefaultTaskVisualConfig,
  generateTaskExprFromConfig,
  getTaskNumberFields,
  getTaskEnumFields,
  type TaskVisualConfig,
} from '@/features/pricing/lib/task-expr'
import type { BillingUsageSchema } from '@/features/pricing/types'

function ConditionEditor({ node, onChange }: { node: VisualCondition; onChange: (node: VisualCondition) => void }) {
  const { t } = useTranslation()
  if (node.kind === 'not')
    return (
      <div className="pricing-condition">
        <strong>{t('Not')}</strong>
        <ConditionEditor node={node.child} onChange={(child) => onChange({ ...node, child })} />
        <Button type="button" variant="ghost" onClick={() => onChange(node.child)}>
          {t('Remove')}
        </Button>
      </div>
    )
  if (node.kind !== 'comparison')
    return (
      <div className="pricing-condition">
        <select
          aria-label={t('Match conditions')}
          value={node.kind}
          onChange={(event) => onChange({ ...node, kind: event.target.value as 'all' | 'any' })}
        >
          <option value="all">{t('All conditions')}</option>
          <option value="any">{t('Any condition')}</option>
        </select>
        {node.children.map((child, i) => (
          <div key={child.id}>
            <ConditionEditor
              node={child}
              onChange={(value) => onChange({ ...node, children: node.children.map((item, index) => (index === i ? value : item)) })}
            />
            <Button type="button" variant="ghost" onClick={() => onChange({ ...node, children: node.children.filter((_, index) => index !== i) })}>
              {t('Remove')}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...node,
              children: [...node.children, { id: visualNodeId(), kind: 'comparison', probe: 'len', timezone: '', operator: '<=', value: '' }],
            })
          }
        >
          {t('Add condition')}
        </Button>
      </div>
    )
  return (
    <div className="pricing-condition-row">
      <select
        aria-label={t('Condition variable')}
        value={node.probe}
        onChange={(event) => onChange({ ...node, probe: event.target.value as typeof node.probe, timezone: node.timezone || 'Asia/Shanghai' })}
      >
        {['len', 'p', 'c', ...TIME_FUNCTIONS].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      {TIME_FUNCTIONS.includes(node.probe as (typeof TIME_FUNCTIONS)[number]) && (
        <Input aria-label={t('Timezone')} value={node.timezone} onChange={(event) => onChange({ ...node, timezone: event.target.value })} />
      )}
      <select
        aria-label={t('Comparison')}
        value={node.operator}
        onChange={(event) => onChange({ ...node, operator: event.target.value as typeof node.operator })}
      >
        {['<', '<=', '>', '>=', '==', '!='].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <Input
        aria-label={t('Condition value')}
        type="number"
        min={0}
        step="any"
        value={node.value}
        onChange={(event) => onChange({ ...node, value: event.target.value })}
      />
      <Button type="button" variant="ghost" onClick={() => onChange({ id: visualNodeId(), kind: 'all', children: [node] })}>
        {t('Group conditions')}
      </Button>
      <Button type="button" variant="ghost" onClick={() => onChange({ id: visualNodeId(), kind: 'not', child: node })}>
        {t('Not')}
      </Button>
    </div>
  )
}

function TierEditor({ node, onChange }: { node: VisualPricingNode; onChange: (node: VisualPricingNode) => void }) {
  const { t } = useTranslation()
  if (node.kind === 'branch')
    return (
      <section className="pricing-branch">
        <ConditionEditor node={node.condition} onChange={(condition) => onChange({ ...node, condition })} />
        <p className="small-note">{t('When matched')}</p>
        <TierEditor node={node.yes} onChange={(yes) => onChange({ ...node, yes })} />
        <p className="small-note">{t('Otherwise')}</p>
        <TierEditor node={node.no} onChange={(no) => onChange({ ...node, no })} />
        <div className="action-buttons">
          <Button type="button" variant="ghost" onClick={() => onChange(node.yes)}>
            {t('Keep matched branch')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onChange(node.no)}>
            {t('Keep fallback branch')}
          </Button>
        </div>
      </section>
    )
  return (
    <section className="pricing-tier">
      <div className="admin-form-grid">
        <label className="field">
          <span>{t('Tier label')}</span>
          <Input value={node.label} onChange={(event) => onChange({ ...node, label: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('Billing unit')}</span>
          <select value={node.billingUnit} onChange={(event) => onChange({ ...node, billingUnit: event.target.value as 'token' | 'request' })}>
            <option value="token">{t('USD per million tokens')}</option>
            <option value="request">{t('Price per request (USD)')}</option>
          </select>
        </label>
      </div>
      {node.billingUnit === 'request' ? (
        <label className="field">
          <span>{t('Price per request (USD)')}</span>
          <Input
            type="number"
            min={0}
            step="any"
            value={node.fixedPrice}
            onChange={(event) => onChange({ ...node, fixedPrice: event.target.value })}
          />
        </label>
      ) : (
        <div className="pricing-price-grid">
          {TOKEN_VARIABLES.filter((variable) => variable !== 'len').map((variable) => {
            const price = node.prices.find((item) => item.variable === variable)
            return (
              <label className="field" key={variable}>
                <span>
                  {t(BILLING_PRICING_VARS.find((field) => field.key === variable)?.shortLabel || variable)} <code>{variable}</code>
                </span>
                <Input
                  aria-label={`${node.label} ${variable}`}
                  type="number"
                  min={0}
                  step="any"
                  placeholder={t('Not separately priced')}
                  value={price?.value ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    const prices = !value
                      ? node.prices.filter((item) => item.variable !== variable)
                      : price
                        ? node.prices.map((item) => (item.variable === variable ? { ...item, value } : item))
                        : [...node.prices, { variable, value }]
                    onChange({ ...node, prices })
                  }}
                />
              </label>
            )
          })}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange({
            id: visualNodeId(),
            kind: 'branch',
            condition: { id: visualNodeId(), kind: 'comparison', probe: 'len', timezone: '', operator: '<=', value: '' },
            yes: { ...node, id: visualNodeId(), origin: undefined },
            no: node,
          })
        }
      >
        {t('Split into tiers')}
      </Button>
    </section>
  )
}

function TaskEditor({
  config,
  schema,
  onChange,
}: {
  config: TaskVisualConfig
  schema: BillingUsageSchema
  onChange: (config: TaskVisualConfig) => void
}) {
  const { t, i18n } = useTranslation()
  const enums = getTaskEnumFields(schema)
  return (
    <>
      {config.tiers.map((tier, index) => (
        <section className="pricing-tier" key={index}>
          <label className="field">
            <span>{t('Tier label')}</span>
            <Input
              value={tier.label}
              onChange={(event) => onChange({ tiers: config.tiers.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)) })}
            />
          </label>
          {index < config.tiers.length - 1 && (
            <>
              {tier.conditions.map((condition, n) => (
                <div className="pricing-condition-row" key={n}>
                  <select
                    aria-label={t('Condition variable')}
                    value={condition.field}
                    onChange={(event) => {
                      const field = event.target.value
                      onChange({
                        tiers: config.tiers.map((item, i) =>
                          i === index
                            ? { ...item, conditions: item.conditions.map((c, j) => (j === n ? { field, value: schema[field].enum![0] } : c)) }
                            : item
                        ),
                      })
                    }}
                  >
                    {enums.map(([key]) => (
                      <option key={key}>{key}</option>
                    ))}
                  </select>
                  <select
                    aria-label={t('Condition value')}
                    value={condition.value}
                    onChange={(event) =>
                      onChange({
                        tiers: config.tiers.map((item, i) =>
                          i === index
                            ? { ...item, conditions: item.conditions.map((c, j) => (j === n ? { ...c, value: event.target.value } : c)) }
                            : item
                        ),
                      })
                    }
                  >
                    {schema[condition.field]?.enum?.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      onChange({
                        tiers: config.tiers.map((item, i) =>
                          i === index ? { ...item, conditions: item.conditions.filter((_, j) => j !== n) } : item
                        ),
                      })
                    }
                  >
                    {t('Remove')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={!enums.length}
                onClick={() =>
                  onChange({
                    tiers: config.tiers.map((item, i) =>
                      i === index ? { ...item, conditions: [...item.conditions, { field: enums[0][0], value: enums[0][1].enum![0] }] } : item
                    ),
                  })
                }
              >
                {t('Add condition')}
              </Button>
            </>
          )}
          <div className="pricing-price-grid">
            {[['$constant', { unit: 'USD', description: t('Fixed component (USD)') }], ...getTaskNumberFields(schema)].map(([field, definition]) => {
              const key = field as string
              const def = definition as { unit?: string; description?: string | Record<string, string> }
              const description =
                typeof def.description === 'string' ? t(def.description) : def.description?.[i18n.language] || def.description?.en || key
              const value = key === '$constant' ? tier.constant : tier.unitPrices[key]
              return (
                <label className="field" key={key}>
                  <span>
                    {description} <small>({def.unit === 'token' ? t('USD per million tokens') : def.unit})</small>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={Number.isFinite(value) ? value : ''}
                    onChange={(event) => {
                      const amount = event.target.value === '' ? NaN : Number(event.target.value)
                      onChange({
                        tiers: config.tiers.map((item, i) =>
                          i !== index
                            ? item
                            : key === '$constant'
                              ? { ...item, constant: amount }
                              : { ...item, unitPrices: { ...item.unitPrices, [key]: amount } }
                        ),
                      })
                    }}
                  />
                </label>
              )
            })}
          </div>
          <div className="action-buttons">
            <Button
              type="button"
              variant="outline"
              disabled={!enums.length}
              onClick={() =>
                onChange({
                  tiers: [
                    ...config.tiers.slice(0, index),
                    { ...tier, conditions: [{ field: enums[0][0], value: enums[0][1].enum![0] }] },
                    ...config.tiers.slice(index),
                  ],
                })
              }
            >
              {t('Split into tiers')}
            </Button>
            {config.tiers.length > 1 && (
              <Button type="button" variant="ghost" onClick={() => onChange({ tiers: config.tiers.filter((_, i) => i !== index) })}>
                {t('Remove')}
              </Button>
            )}
          </div>
        </section>
      ))}
    </>
  )
}

export function BillingExpressionEditor({
  value,
  onChange,
  schema,
  onValidityChange,
  readOnly = false,
}: {
  value: string
  onChange: (value: string) => void
  schema?: BillingUsageSchema
  onValidityChange: (valid: boolean) => void
  readOnly?: boolean
}) {
  const { t } = useTranslation()
  const [document, setDocument] = useState<VisualBillingDocument | null>(null)
  const [task, setTask] = useState<TaskVisualConfig | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const invalidParts = useRef(new Set<string>())
  const [rulesOpen, setRulesOpen] = useState(false)
  const [rulesEpoch, setRulesEpoch] = useState(0)
  function validity(part: string, valid: boolean) {
    if (valid) invalidParts.current.delete(part)
    else invalidParts.current.add(part)
    onValidityChange(invalidParts.current.size === 0)
  }
  function visual() {
    const { billingExpr } = pricingExpressionParts(value)
    const doc = parseVisualBillingDocument(billingExpr)
    const taskDoc = taskVisualDraft(value, schema)
    setDocument(doc)
    setTask(taskDoc)
    setIssues(doc || taskDoc ? [] : [t('This expression cannot be edited visually without losing information.')])
    validity('price', true)
  }
  function change(next: VisualBillingDocument) {
    setDocument(next)
    const result = serializeVisualBillingDocument(next)
    setIssues(result.ok ? [] : result.issues.map((issue) => issue.message))
    validity('price', result.ok)
    if (result.ok) onChange(combinePricingDraft(result.source, value))
  }
  return (
    <div className="pricing-expression-editor">
      <div className="action-buttons">
        <Button type="button" variant="outline" disabled={readOnly || !value.trim()} onClick={visual}>
          {t('Visual editor')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDocument(null)
            setTask(null)
            setIssues([])
            setRulesOpen(false)
            setRulesEpoch((previous) => previous + 1)
            invalidParts.current.clear()
            validity('price', true)
          }}
        >
          {t('Raw expression')}
        </Button>
      </div>
      {!value.trim() && !readOnly && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const initial =
              schema && getTaskNumberFields(schema).length
                ? generateTaskExprFromConfig(createDefaultTaskVisualConfig(schema), schema)
                : 'tier("base", p * 0 + c * 0)'
            onChange(initial)
            setDocument(parseVisualBillingDocument(initial))
            setTask(taskVisualDraft(initial, schema))
            setIssues([])
            validity('price', true)
          }}
        >
          {t('Create zero-price draft')}
        </Button>
      )}
      <p className="small-note">
        {t('Blank token prices remain inherited within the expression; zero opts into separate free pricing. Use len for context tiers.')}
      </p>
      {document && (
        <>
          <label className="checkbox-label">
            <input
              type="checkbox"
              disabled={!document.imageCount && !isRequestPricingTree(document.root)}
              checked={!!document.imageCount}
              onChange={(event) => {
                const next = setVisualImageCount(document, event.target.checked)
                if (next) change(next)
                else {
                  setIssues(['This expression cannot be edited visually without losing information.'])
                  validity('price', false)
                }
              }}
            />
            {t('Multiply by image count')}
          </label>
          <TierEditor node={document.root} onChange={(root) => change({ ...document, root })} />
        </>
      )}
      {task && schema && (
        <TaskEditor
          config={task}
          schema={schema}
          onChange={(next) => {
            setTask(next)
            const valid = next.tiers.every(
              (tier, i) =>
                [tier.constant, ...Object.values(tier.unitPrices)].every((price) => Number.isFinite(price) && price >= 0) &&
                (i === next.tiers.length - 1 || tier.conditions.length > 0)
            )
            const generated = valid ? generateTaskExprFromConfig(next, schema) : ''
            validity('price', !!generated)
            setIssues(generated ? [] : ['Enter a finite, non-negative price.'])
            if (generated) onChange(combinePricingDraft(generated, value))
          }}
        />
      )}
      {issues.length > 0 && (
        <div role="alert">
          {issues.map((issue, i) => (
            <p className="small-note" key={i}>
              {t(issue)}
            </p>
          ))}
        </div>
      )}
      {!readOnly && !!value.trim() && (
        <RequestRulesEditor
          key={rulesEpoch}
          value={value}
          onChange={onChange}
          onValidityChange={(valid) => validity('rules', valid)}
          onEditingChange={setRulesOpen}
        />
      )}
      <PriceSimulation expression={value} schema={schema} />
      <label className="field">
        <span>{t('Billing expression')}</span>
        <Textarea
          className="admin-pricing-expression"
          readOnly={readOnly || !!document || !!task || rulesOpen}
          spellCheck={false}
          rows={5}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            validity('price', true)
          }}
        />
      </label>
    </div>
  )
}
