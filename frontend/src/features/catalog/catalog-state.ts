import type { AuthBundle, CatalogModel, Offering } from '@/lib/api/types'
import type { PerformanceSummary } from '@/features/performance/types'
import { catalogDisplayKey, type VideoBillingMode } from './video-billing'
import { isSeedanceFamily } from './seedance-families'

export const UNKNOWN_PROVIDER = '__unknown__'

export function catalogListKey(currency: 'CNY' | 'USD', bundle: AuthBundle | null) {
  return ['catalog', currency, bundle?.user.id ?? 0, bundle?.user.group ?? '', bundle?.session.sid ?? 'public'] as const
}

export function catalogModelKey(
  key: string,
  currency: 'CNY' | 'USD',
  bundle: AuthBundle | null,
  keyType: 'catalog_key' | 'model_id' = 'catalog_key'
) {
  return ['catalog-model', key, currency, bundle?.user.id ?? 0, bundle?.user.group ?? '', bundle?.session.sid ?? 'public', keyType] as const
}

export function modelDetailHref(
  model: string,
  catalogKey?: string,
  group?: string,
  currency?: 'CNY' | 'USD',
  billing?: VideoBillingMode,
  offeringKey?: string
) {
  const params = new URLSearchParams()
  if (catalogKey) params.set('catalogKey', catalogKey)
  if (group) params.set('group', group)
  if (currency === 'USD') params.set('currency', currency)
  if (billing) params.set('billing', billing)
  if (offeringKey) params.set('offering', offeringKey)
  const query = params.toString()
  return `/pricing/${encodeURIComponent(model)}${query ? '?' + query : ''}`
}

/** An explicit group must be among the routes returned for this session. */
export function connectRoute(model: CatalogModel | undefined, group?: string, offeringKey?: string) {
  if (!model) return undefined
  if (offeringKey)
    return model.offerings.find(
      (offering) => offering.offering_key === offeringKey && (!group || offering.name === group) && catalogRouteUsable(offering)
    )
  return group
    ? model.offerings.find((offering) => offering.name === group && catalogRouteUsable(offering))
    : model.offerings.find(catalogRouteUsable)
}

export function catalogRouteUsable(offering: Offering) {
  const quote = offering.prices?.[0]
  return offering.availability !== 'unavailable' && quote?.status !== 'unconfigured' && (!quote?.billing_group_scoped || !!quote.billing_expr?.trim())
}

/** Keep only the model and route identifiers needed to resume the connection guide. */
export function connectReturnPath(model: string, group?: string, catalogKey?: string, offeringKey?: string, currency?: 'CNY' | 'USD') {
  const params = new URLSearchParams()
  if (group) params.set('group', group)
  if (catalogKey) params.set('catalogKey', catalogKey)
  if (offeringKey) params.set('offering', offeringKey)
  if (currency === 'USD') params.set('currency', currency)
  const query = params.toString()
  return `/pricing/${encodeURIComponent(model)}/connect${query ? '?' + query : ''}`
}

/** Project routes onto the currently selected groups. */
export function catalogOfferings(model: CatalogModel, groups: string[]) {
  return groups.length ? model.offerings.filter((offering) => groups.includes(offering.name)) : model.offerings
}

/** Discard models no longer visible before applying the comparison limit. */
export function toggleCatalogComparison(selected: string[], modelKey: string, models: CatalogModel[]) {
  const available = new Set(models.map(catalogDisplayKey))
  const current = selected.filter((key) => available.has(key))
  if (current.includes(modelKey)) return current.filter((key) => key !== modelKey)
  if (current.length >= 4) return null
  return [...current, modelKey]
}

/** Choose a fixed quote only when every component is comparable and no more expensive. */
export function catalogQuoteSummary(model: CatalogModel, groups: string[]) {
  const allRoutes = catalogOfferings(model, groups),
    usable = allRoutes.filter(catalogRouteUsable)
  const routes = usable.length ? usable : allRoutes,
    keys = new Set(routes.map((offering) => offering.offering_key))
  const summaries = model.price_summary.filter((summary) => keys.has(summary.offering_key))
  const first =
    summaries.find(({ quote }) => !quote.billing_group_scoped || (quote.status !== 'unconfigured' && !!quote.billing_expr?.trim())) || summaries[0]
  if (!first || summaries.length !== routes.length) return first
  const vectors = summaries.map(({ quote }) => {
    if (quote.billing_group_scoped || quote.status !== 'fixed' || !quote.components.length) return null
    const parts = [...quote.components].sort((a, b) => a.kind.localeCompare(b.kind))
    const basis = JSON.stringify([quote.currency, parts.map((part) => [part.kind, part.unit, part.quantity])])
    const values = parts.map((part) => (part.amount.trim() ? Number(part.amount) : NaN))
    if (
      new Set(parts.map((part) => part.kind)).size !== parts.length ||
      parts.some((part) => !Number.isFinite(part.quantity) || part.quantity <= 0) ||
      values.some((value) => !Number.isFinite(value) || value < 0)
    )
      return null
    return { basis, values }
  })
  if (vectors.some((vector) => !vector || vector.basis !== vectors[0]?.basis)) return first
  const lowest = vectors.findIndex((candidate) => vectors.every((other) => candidate!.values.every((value, index) => value <= other!.values[index])))
  return summaries[lowest < 0 ? 0 : lowest]
}
export function catalogQuote(model: CatalogModel, groups: string[]) {
  return catalogQuoteSummary(model, groups)?.quote
}

function displayedPrice(model: CatalogModel, groups: string[]) {
  if (isSeedanceFamily(model.model_key)) return null
  const quote = catalogQuote(model, groups)
  const component = quote?.components.find((part) => ['input', 'output', 'request'].includes(part.kind))
  if (
    !quote ||
    quote.billing_group_scoped ||
    !component ||
    !component.amount.trim() ||
    !Number.isFinite(component.quantity) ||
    component.quantity <= 0
  )
    return null
  const amount = Number(component.amount)
  if (!Number.isFinite(amount) || amount < 0) return null
  const rank = component.unit === 'token' ? 0 : component.unit === 'request' ? 1 : 2
  return { rank, basis: JSON.stringify([quote.currency, component.unit, component.quantity, component.kind]), amount }
}

export interface CatalogFilters {
  q: string
  modality: string
  providers: string[]
  groups: string[]
  inputs?: string[]
  sort: string
  currency: 'CNY' | 'USD'
  page: number
}
export function readCatalogFilters(query: string): CatalogFilters {
  const params = new URLSearchParams(query),
    page = Number(params.get('page') || 1)
  return {
    q: params.get('q') || '',
    modality: params.get('modality') || 'all',
    providers: [...new Set(params.getAll('provider').filter(Boolean))],
    groups: [...new Set(params.getAll('group').filter(Boolean))],
    inputs: [...new Set(params.getAll('input').filter(Boolean))],
    sort: params.get('sort') || 'name',
    currency: 'CNY',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}
export function catalogFilterQuery(query: string, key: string, values: string | string[]) {
  const params = new URLSearchParams(query)
  params.delete('currency')
  if (key !== 'page') params.delete('page')
  params.delete(key)
  for (const value of [values].flat()) if (value && (key !== 'modality' || value !== 'all')) params.append(key, value)
  return params.toString()
}
const CATALOG_SEARCH_ALIASES: [string, string[]][] = [
  ['千问', ['qwen', 'tongyi', 'alibaba']],
  ['通义', ['qwen', 'tongyi', 'wan', 'alibaba']],
  ['通义千问', ['qwen']],
  ['通义万相', ['wan']],
  ['万相', ['wan']],
  ['豆包', ['doubao', 'bytedance']],
  ['即梦', ['seedance', 'jimeng', 'bytedance']],
  ['字节', ['bytedance', 'doubao', 'seedance']],
  ['字节跳动', ['bytedance', 'doubao', 'seedance']],
  ['克劳德', ['claude', 'anthropic']],
  ['谷歌', ['google', 'gemini']],
  ['双子星', ['gemini']],
  ['深度求索', ['deepseek']],
  ['智谱', ['zhipu', 'glm', 'z.ai', 'zai']],
  ['月之暗面', ['moonshot', 'kimi']],
  ['可灵', ['kling', 'kuaishou']],
  ['快手', ['kuaishou', 'kling']],
  ['画图', ['image', 'dall', 'flux', 'midjourney', 'wan', 'seedream', 'imagen']],
  ['生图', ['image', 'dall', 'flux', 'midjourney', 'wan', 'seedream', 'imagen']],
  ['文生图', ['image', 'dall', 'flux', 'midjourney', 'wan', 'seedream', 'imagen']],
  ['图片', ['image']],
  ['图像', ['image']],
  ['视频', ['video', 'seedance', 'sora', 'veo', 'kling', 'wan']],
  ['生视频', ['video', 'seedance', 'sora', 'veo', 'kling', 'wan']],
  ['文生视频', ['video', 'seedance', 'sora', 'veo', 'kling', 'wan']],
  ['语音', ['audio', 'speech', 'tts', 'whisper']],
  ['音频', ['audio']],
  ['文本', ['text']],
  ['对话', ['text', 'chat']],
  ['向量', ['embedding']],
  ['嵌入', ['embedding']],
  ['推理', ['reasoning', 'thinking', 'o1', 'o3', 'r1']],
]

function matchesCatalogTerm(term: string, text: string): boolean {
  if (text.includes(term)) return true
  for (const [alias, expansions] of CATALOG_SEARCH_ALIASES) {
    if (term === alias) {
      if (expansions.some((expansion) => text.includes(expansion))) return true
      continue
    }
    if (alias.length >= 2 && term.includes(alias)) {
      const remainder = term.replace(alias, '').trim()
      if (expansions.some((expansion) => text.includes(expansion) && (!remainder || text.includes(remainder)))) return true
    }
  }
  return false
}

export function filterCatalog<T extends CatalogModel>(models: T[], filters: CatalogFilters, metrics: Map<string, PerformanceSummary> = new Map()) {
  const terms = filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const rows = models.filter((model) => {
    const text = [
      model.name,
      model.configured_model_id,
      model.provider,
      model.modality,
      ...model.capabilities,
      ...model.offerings.flatMap((route) => [route.invocation_id, route.catalog_label || '']),
    ]
      .join(' ')
      .toLowerCase()
    return (
      terms.every((term) => matchesCatalogTerm(term, text)) &&
      (filters.modality === 'all' || model.modality === filters.modality) &&
      (!filters.providers.length || filters.providers.includes(model.provider || UNKNOWN_PROVIDER)) &&
      (!filters.groups.length || model.offerings.some((offering) => filters.groups.includes(offering.name))) &&
      (!filters.inputs?.length || filters.inputs.some((input) => (model.input_modalities || []).includes(input)))
    )
  })
  const prices = filters.sort === 'price' ? new Map(rows.map((model) => [model, displayedPrice(model, filters.groups)] as const)) : null
  return rows.sort((a, b) => {
    if (prices) {
      const left = prices.get(a),
        right = prices.get(b)
      if (!left || !right) return left ? -1 : right ? 1 : a.name.localeCompare(b.name)
      return left.rank - right.rank || left.basis.localeCompare(right.basis) || left.amount - right.amount || a.name.localeCompare(b.name)
    }
    if (filters.sort === 'context') return (b.context_window ?? -1) - (a.context_window ?? -1) || a.name.localeCompare(b.name)
    if (filters.sort === 'success' || filters.sort === 'speed') {
      const key = filters.sort === 'success' ? 'success_rate' : 'avg_tps'
      const left = isSeedanceFamily(a.model_key) ? undefined : metrics.get(a.configured_model_id),
        right = isSeedanceFamily(b.model_key) ? undefined : metrics.get(b.configured_model_id)
      const leftValue = key === 'avg_tps' && left?.has_tps === false ? -Infinity : (left?.[key] ?? -Infinity)
      const rightValue = key === 'avg_tps' && right?.has_tps === false ? -Infinity : (right?.[key] ?? -Infinity)
      return rightValue - leftValue || a.name.localeCompare(b.name)
    }
    return a.name.localeCompare(b.name)
  })
}
