import type { CatalogModel } from '@/lib/api/types'

export interface HomeSelection {
  model: string
  offering: string
}

/** Resolve both selections against the current catalog, so routes cannot leak between models. */
export function homeConnection(models: CatalogModel[], selection: HomeSelection) {
  const model = models.find((model) => model.model_key === selection.model) || models[0]
  if (!model) return null
  const offering = model.offerings.find((route) => route.offering_key === selection.offering) || model.offerings[0]
  if (!offering) return { model, offering: null, connectHref: null, keyHref: null }
  const params = new URLSearchParams({ catalogKey: model.model_key, offering: offering.offering_key, group: offering.name })
  return {
    model,
    offering,
    connectHref: `/pricing/${encodeURIComponent(model.configured_model_id)}/connect?${params}`,
    keyHref: `/keys?${new URLSearchParams({ create: '1', group: offering.name })}`,
  }
}
