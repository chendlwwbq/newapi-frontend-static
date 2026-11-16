import type { TFunction } from 'i18next'

/** Catalog labels are presentation only; requests keep the configured group ID. */
export function catalogGroupLabel(group: string, t: TFunction, description?: string): string {
  if ((group.startsWith('xlsx-g-') || group.startsWith('dddai-')) && description?.trim()) return description.trim()
  if (group === 'video-special') return t('Special price route')
  if (group === 'video-stable') return t('Stable route')
  return group
}
