import type { CatalogModel } from '@/lib/api/types'

export interface CatalogNotice {
  public_message: string
  models?: string[]
  groups?: string[]
  offering_keys?: string[]
}

/** Display global notices and notices that match a model and an available route. */
export function applicableNotices(notices: CatalogNotice[], models: CatalogModel[], selectedGroups: string[] = []) {
  return notices.filter((notice) => {
    if (!notice || typeof notice.public_message !== 'string' || !notice.public_message.trim()) return false
    if ([notice.models, notice.groups, notice.offering_keys].some((value) => value !== undefined && !Array.isArray(value))) return false
    const targets = notice.models || [],
      groups = notice.groups || [],
      keys = notice.offering_keys || []
    if (!targets.length && !groups.length && !keys.length) return true
    return models.some((model) => {
      const matchesModel = !targets.length || targets.includes(model.model_key) || targets.includes(model.configured_model_id)
      if (!model.offerings.length) return matchesModel && !groups.length && !keys.length
      return model.offerings.some(
        (route) =>
          ((!route.catalog_model_key && matchesModel) ||
            !targets.length ||
            targets.includes(route.catalog_model_key || '') ||
            targets.includes(route.invocation_id)) &&
          (!selectedGroups.length || selectedGroups.includes(route.name)) &&
          (!groups.length || groups.includes(route.name)) &&
          (!keys.length || keys.includes(route.offering_key))
      )
    })
  })
}
