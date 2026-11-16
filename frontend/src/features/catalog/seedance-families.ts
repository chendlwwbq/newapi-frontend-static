import type { TFunction } from 'i18next'
import type { CatalogModel, Offering } from '@/lib/api/types'

// Display membership only. These keys never become API model IDs or route permissions.
const families = {
  mini: [
    'Seedance 2.0 Mini',
    [
      'seedance-2-0-mini-i2v-480p-720p-1080p',
      'seedance-2-0-mini-r2v-480p-720p-1080p',
      'seedance-2-0-mini-second-line-f',
      'seedance-2.0-mini-per-second',
      'seedance-2-0-mini-stable-second',
      'seedance-2-0-mini-second-line-l',
      'seedance-2-0-mini-second-line-m',
    ],
  ],
  fast: [
    'Seedance 2.0 Fast',
    [
      'seedance-2-0-fast-second-line-f',
      'seedance-2.0-fast-per-second',
      'seedance-2-0-fast-stable-second',
      'seedance-2-0-fast-second-line-l',
      'seedance-2-0-fast-second-line-m',
    ],
  ],
  standard: [
    'Seedance 2.0',
    [
      'seedance-2-0',
      'seedance-2-0-standard-second-480p',
      'seedance-2-0-standard-second-720p',
      'seedance-2-0-second-480p',
      'seedance-2-0-second-line-a',
      'seedance-2-0-second-line-b',
      'seedance-2.0-second',
      'seedance-2-0-480p-second-line-c',
      'seedance-2-0-720p-second-line-c',
      'seedance-2-0-second-line-f',
      'seedance-2.0-2',
      'seedance-2-0-720p-second-line-k',
      'seedance-2-0-stable-second',
      'seedance-2-0-second-line-l',
      'seedance-2-0-second-line-m',
    ],
  ],
  full: [
    'Seedance 2.5',
    [
      'seedance-2-5-second-480p',
      'seedance-2-5-second-stable',
      'seedance-2-5-second-special',
      'seedance-2-5-second-line-a',
      'seedance-2-5-second-line-b',
      'seedance-2-5-high-concurrency-second',
      'seedance-2-5-480p-second-line-c',
      'seedance-2-5-480p-second-line-d',
      'seedance-2-5-second-line-f',
      'seedance-2-5-stable-720p-second-line-f',
      'seedance-2-5-720p-second-line-c',
      'seedance-2-5-official-wholesale',
      'seedance-2-5-full-second',
      'seedance-2.5',
      'seedance-2.5-2',
      'seedance-2-5-720p-second-line-k',
      'seedance-2-5-second-line-n',
      'seedance-2-5-stable-second',
      'seedance-2-5-second-line-l',
      'seedance-2-5-second-line-m',
    ],
  ],
  flash: ['Seedance 2.5 Flash', ['seedance-2-5-flash-second']],
} as const

export function isSeedanceFamily(key: string) {
  return Object.keys(families).some((id) => key === `family/seedance-second/${id}`)
}

/** Keep original route keys, groups, prices, and invocation IDs from the authorized response. */
export function groupSeedanceModels(models: CatalogModel[], t: TFunction): CatalogModel[] {
  const result: CatalogModel[] = []
  const grouped = new Map<string, CatalogModel>()
  for (const model of models) {
    const family = Object.entries(families).find(([, [, ids]]) => (ids as readonly string[]).includes(model.configured_model_id))
    const routes = model.offerings.filter((route) => route.name === '视频按秒')
    if (!family || model.modality !== 'video' || !routes.length) {
      result.push(model)
      continue
    }
    const [id, [name]] = family
    const key = `family/seedance-second/${id}`
    const other = model.offerings.filter((route) => route.name !== '视频按秒')
    if (other.length) {
      const keys = new Set(other.map((route) => route.offering_key))
      result.push({
        ...model,
        offerings: other,
        offerings_count: other.length,
        price_summary: model.price_summary.filter((item) => keys.has(item.offering_key)),
      })
    }
    let target = grouped.get(key)
    if (!target) {
      target = {
        ...model,
        model_key: key,
        name,
        description: t('Choose a route to view its model ID, capabilities and price.'),
        context_window: null,
        max_output_tokens: null,
        capabilities: [],
        metrics: [],
        offerings: [],
        offerings_count: 0,
        price_summary: [],
      }
      grouped.set(key, target)
      result.push(target)
    }
    for (const route of routes) {
      if (target.offerings.some((item) => item.offering_key === route.offering_key)) continue
      const label = model.configured_model_id === 'seedance-2.5' ? `${model.name} · ${t('Route')} J` : model.name
      target.offerings.push({ ...route, catalog_model_key: model.model_key, catalog_label: label, catalog_description: model.description })
      target.price_summary.push(...model.price_summary.filter((item) => item.offering_key === route.offering_key))
    }
    target.offerings_count = target.offerings.length
  }
  return result
}

/** A family's selected route is still a real, independently callable model. */
export function routeCatalogModel(model: CatalogModel, route: Offering): CatalogModel {
  if (!route.catalog_model_key) return model
  return {
    ...model,
    model_key: route.catalog_model_key,
    configured_model_id: route.invocation_id,
    name: route.catalog_label || route.invocation_id,
    description: route.catalog_description || '',
    offerings: [route],
    offerings_count: 1,
    price_summary: model.price_summary.filter((item) => item.offering_key === route.offering_key),
  }
}
