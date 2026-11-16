import type { TFunction } from 'i18next'
import type { CatalogModel, Offering } from '@/lib/api/types'

const modes = { 按次: 'request', 按条: 'request', 按秒: 'second' } as const
export const videoRouteTiers = ['稳定', '特价', '备选'] as const
export type VideoBillingMode = 'request' | 'second'
type VideoRouteTier = (typeof videoRouteTiers)[number]
const resolutions = ['480p', '720p', '768p', '1080p', '2k'] as const
type VideoResolution = (typeof resolutions)[number]
type VideoRouteSlot = { mode: VideoBillingMode; tier: VideoRouteTier; resolution?: VideoResolution }
export type CatalogDisplayModel = CatalogModel & { videoBillingMode?: VideoBillingMode }

export function videoBillingGroupSlot(group: string): VideoRouteSlot | undefined {
  const parts = group.split('·').map((part) => part.trim())
  if (parts.length === 3) {
    const resolution = resolutions.find((value) => value === parts[0].toLowerCase())
    const modeLabel = (Object.keys(modes) as (keyof typeof modes)[]).find((value) => value === parts[1])
    const tier = videoRouteTiers.find((value) => value === parts[2])
    if (resolution && modeLabel && tier) return { mode: modes[modeLabel], tier, resolution }
    return
  }
  if (parts.length !== 2) return
  const modeLabel = (Object.keys(modes) as (keyof typeof modes)[]).find((value) => parts.includes(value))
  const tier = videoRouteTiers.find((value) => parts.includes(value))
  if (!modeLabel || !tier) return
  return { mode: modes[modeLabel], tier }
}

export function videoRouteSlot(route: Offering) {
  const slot = videoBillingGroupSlot(route.name)
  if (!slot) return
  const components = route.prices[0]?.components
  if (components?.some((part) => part.unit !== slot.mode)) return
  return slot
}

export function catalogDisplayKey(model: CatalogDisplayModel) {
  return model.videoBillingMode ? `${model.model_key}/billing/${model.videoBillingMode}` : model.model_key
}

export function videoResolutionRoutes(offerings: Offering[]) {
  const groups = new Map<VideoResolution, { route: Offering; slot: VideoRouteSlot }[]>()
  const other: Offering[] = []
  for (const route of offerings) {
    const slot = videoRouteSlot(route)
    if (!slot?.resolution) {
      other.push(route)
      continue
    }
    const group = groups.get(slot.resolution) ?? []
    group.push({ route, slot })
    groups.set(slot.resolution, group)
  }
  return {
    groups: resolutions.flatMap((resolution) => {
      const routes = groups.get(resolution)
      return routes ? [{ resolution, routes }] : []
    }),
    other,
  }
}

export function catalogVideoEntries(model: CatalogModel, t: TFunction): CatalogDisplayModel[] {
  if (
    model.modality !== 'video' ||
    !model.offerings.length ||
    !model.offerings.every((route) => {
      const slot = videoRouteSlot(route)
      return slot && !slot.resolution
    })
  )
    return [model]
  return (['request', 'second'] as const).map((mode) => {
    const offerings = model.offerings.filter((route) => videoRouteSlot(route)?.mode === mode)
    const keys = new Set(offerings.map((route) => route.offering_key))
    const name = mode === 'request' ? t('{{model}} (per request)', { model: model.name }) : t('{{model}} (per second)', { model: model.name })
    return {
      ...model,
      name,
      videoBillingMode: mode,
      offerings,
      offerings_count: offerings.length,
      price_summary: model.price_summary.filter((summary) => keys.has(summary.offering_key)),
    }
  })
}
