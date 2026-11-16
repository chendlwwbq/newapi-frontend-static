'use client'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toIntlLocale } from '@/i18n/languages'
import { createCurrencyFormatter } from '@/lib/currency'
import { compileBillingExpression } from './lib/billing-expression/parser'
import { BILLING_PRICING_VARS } from './lib/billing-expr'
import type { BillingUsageSchema } from './types'
import { simulatePrice, type SimulationInput } from './simulation'

function SimulationForm({ expression, schema, groupRatio }: { expression: string; schema?: BillingUsageSchema; groupRatio?: number }) {
  const { t, i18n } = useTranslation()
  const compiled = useMemo(() => compileBillingExpression(expression), [expression])
  const [input, setInput] = useState<SimulationInput>(() => ({
    tokens: { p: '1000', c: '500', len: '1000', cr: '0', cc: '0', cc1h: '0', cc12h: '0', img: '0', img_cr: '0', img_o: '0', ai: '0', ao: '0' },
    usage: {},
    body: '{}',
    headers: '{}',
    time: new Date().toISOString(),
    imageCount: '1',
  }))
  const [evaluation, setEvaluation] = useState<{ fingerprint: string; value: ReturnType<typeof simulatePrice> } | null>(null)
  const fingerprint = JSON.stringify([expression, input, schema, groupRatio]),
    result = evaluation?.fingerprint === fingerprint ? evaluation.value : null
  const format = createCurrencyFormatter({
    displayInCurrency: true,
    quotaDisplayType: 'USD',
    quotaPerUnit: 500000,
    usdExchangeRate: 1,
    customCurrencySymbol: '¤',
    customCurrencyExchangeRate: 1,
  })
  const money = (usd: number) =>
    format.formatBillingCurrencyFromUSD(usd, { locale: toIntlLocale(i18n.language), digitsLarge: 8, digitsSmall: 10, abbreviate: false })
  return (
    <div className="price-simulation-form">
      {compiled.status === 'ready' && Array.from(compiled.variables).some((variable) => variable !== 'image_count') && (
        <p className="small-note">
          {t('Enter normalized billable tokens. p and c exclude separately priced categories; len is the full input context.')}
        </p>
      )}
      <div className="pricing-price-grid">
        {compiled.status === 'ready' &&
          Array.from(compiled.variables).map((variable) =>
            variable === 'image_count' ? (
              <label className="field" key={variable}>
                <span>{t('Billable image count')}</span>
                <Input
                  type="number"
                  min={1}
                  max={128}
                  step={1}
                  value={input.imageCount}
                  onChange={(event) => setInput({ ...input, imageCount: event.target.value })}
                />
              </label>
            ) : (
              <label className="field" key={variable}>
                <span>
                  {t(variable === 'len' ? 'Context length' : BILLING_PRICING_VARS.find((field) => field.key === variable)?.shortLabel || variable)}{' '}
                  <code>{variable}</code>
                </span>
                <Input
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  value={input.tokens[variable] ?? ''}
                  onChange={(event) => setInput({ ...input, tokens: { ...input.tokens, [variable]: event.target.value } })}
                />
              </label>
            )
          )}
        {Object.entries(schema || {}).map(([key, field]) => (
          <label className="field" key={key}>
            <span>
              {key} {field.unit && <small>({field.unit})</small>}
            </span>
            {field.type === 'number' ? (
              <Input
                type="number"
                min={0}
                step="any"
                value={input.usage[key] ?? ''}
                onChange={(event) => setInput({ ...input, usage: { ...input.usage, [key]: event.target.value } })}
              />
            ) : (
              <select
                value={input.usage[key] ?? ''}
                onChange={(event) => setInput({ ...input, usage: { ...input.usage, [key]: event.target.value } })}
              >
                <option value="">{t('Not provided')}</option>
                {(field.type === 'boolean' ? ['true', 'false'] : field.enum || []).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            )}
          </label>
        ))}
      </div>
      <div className="pricing-price-grid">
        <label className="field">
          <span>{t('Request body')} (JSON)</span>
          <Textarea rows={3} value={input.body} onChange={(event) => setInput({ ...input, body: event.target.value })} />
        </label>
        <label className="field">
          <span>{t('Request headers')} (JSON)</span>
          <Textarea rows={3} value={input.headers} onChange={(event) => setInput({ ...input, headers: event.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>{t('Simulation time')} (ISO 8601)</span>
        <Input value={input.time} onChange={(event) => setInput({ ...input, time: event.target.value })} />
      </label>
      <Button type="button" variant="outline" onClick={() => setEvaluation({ fingerprint, value: simulatePrice(expression, input, schema) })}>
        {t('Calculate estimate')}
      </Button>
      {result?.error && (
        <p role="alert">
          {t('Cannot calculate estimate')}: {t(result.error)}
        </p>
      )}
      {result?.result && (
        <div className="price-simulation-result" role="status">
          <strong>
            {t('Base estimate')}: {money(result.usd!)}
          </strong>
          <p>
            {t('Matched tier')}: <code>{result.result.matchedTier || '—'}</code> · {t('Billing unit')}:{' '}
            {t(
              compiled.status === 'ready' && compiled.functions.has('u')
                ? 'Task pricing'
                : result.result.billingUnit === 'request'
                  ? 'Per request'
                  : 'Per million tokens'
            )}
          </p>
          {groupRatio !== undefined && (
            <p>
              {t('Group ratio')}: {groupRatio} · {t('Estimate with group ratio')}: {money(result.usd! * groupRatio)}
            </p>
          )}
          {result.result.requestRules.map((rule, i) => (
            <p key={i}>
              <code>{rule.cond}</code> · ×{rule.multiplier} · {t(rule.matched ? 'Matched' : 'Not matched')}
            </p>
          ))}
        </div>
      )}
      <p className="small-note">
        {t('Local estimate only. Group ratios apply only when shown; tool fees, quota rounding and final settlement are excluded.')}
      </p>
    </div>
  )
}

export function PriceSimulation(props: { expression: string; schema?: BillingUsageSchema; groupRatio?: number }) {
  const { t } = useTranslation(),
    [open, setOpen] = useState(false)
  if (!props.expression.trim()) return null
  return (
    <section className="price-simulation">
      <Button type="button" variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('Price estimate')}
      </Button>
      {open && <SimulationForm {...props} />}
    </section>
  )
}
