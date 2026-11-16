import type { PrefillGroup } from '../prefill-groups-page'

export type PortablePrefill = Pick<PrefillGroup, 'name' | 'type' | 'items' | 'description'>
export interface PrefillImportEntry {
  group: PortablePrefill
  action: 'create' | 'update' | 'skip'
  existing?: PrefillGroup
}

export function portablePrefill(group: PortablePrefill): PortablePrefill {
  return { name: group.name, type: group.type, items: group.items, ...(group.description ? { description: group.description } : {}) }
}
export function parsePrefillImport(text: string): PortablePrefill[] {
  const input: unknown = JSON.parse(text)
  const groups = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && 'version' in input && input.version === 1 && 'groups' in input
      ? input.groups
      : null
  if (!Array.isArray(groups) || !groups.length || groups.length > 1000) throw new Error('Import between 1 and 1000 prefill groups.')
  const names = new Set<string>()
  return groups.map((value) => {
    if (!value || typeof value !== 'object' || typeof value.name !== 'string' || !['model', 'tag', 'endpoint'].includes(value.type))
      throw new Error('Invalid prefill group record.')
    const name = value.name.trim()
    if (!name || [...name].length > 64 || names.has(name)) throw new Error('Group names must be unique and contain 1 to 64 characters.')
    names.add(name)
    if (value.description !== undefined && (typeof value.description !== 'string' || [...value.description].length > 255))
      throw new Error('Invalid prefill group description.')
    let items: unknown = value.items
    if (typeof items === 'string') items = value.type === 'endpoint' || items.trim().startsWith('[') ? JSON.parse(items) : items.split(/[\n,]/)
    if (value.type === 'endpoint') {
      if (!items || typeof items !== 'object') throw new Error('Use a string array for models and tags, or a JSON object or array for endpoints.')
    } else {
      if (!Array.isArray(items) || !items.every((item) => typeof item === 'string'))
        throw new Error('Use a string array for models and tags, or a JSON object or array for endpoints.')
      items = [...new Set(items.map((item) => item.trim()).filter(Boolean))]
    }
    return portablePrefill({ name, type: value.type, items: items as PrefillGroup['items'], description: value.description })
  })
}
export function planPrefillImport(groups: PortablePrefill[], existing: PrefillGroup[], replace: boolean): PrefillImportEntry[] {
  const byName = new Map(existing.map((group) => [group.name, group]))
  return groups.map((group) => {
    const current = byName.get(group.name)
    return { group, action: current ? (replace ? 'update' : 'skip') : 'create', existing: current }
  })
}
