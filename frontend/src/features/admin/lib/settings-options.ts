import type { SettingsSection } from '../settings-schema'
import { validateSettingsCollection, validateSettingsUrl } from './settings-collections'

export interface OptionChange {
  key: string
  value: string | number | boolean
}

/** Write-only credentials must never enter the query cache. */
export function projectOptionValues(records: { key: string; value: string }[], sections: Record<string, SettingsSection>) {
  const readable = new Set(Object.values(sections).flatMap((section) => section.fields.filter((field) => !field.writeOnly).map((field) => field.key)))
  readable.add('ResendKeyConfigured')
  for (const key of [
    'payment_setting.compliance_confirmed',
    'payment_setting.compliance_terms_version',
    'payment_setting.compliance_confirmed_at',
    'payment_setting.compliance_confirmed_by',
    'WaffoPancakeMerchantID',
    'WaffoPancakeReturnURL',
    'WaffoPancakeStoreID',
    'WaffoPancakeProductID',
  ])
    readable.add(key)
  for (const key of ['passkey.rp_id', 'passkey.legacy_rp_ids', 'passkey.origins']) readable.add(key)
  return Object.fromEntries(records.filter((record) => readable.has(record.key)).map((record) => [record.key, record.value]))
}

/** Native options are individual writes; disable dependencies first and enable them last. */
export function prepareOptionChanges(
  section: SettingsSection,
  baseline: Record<string, string>,
  draft: Record<string, string>,
  cleared: ReadonlySet<string>
): OptionChange[] {
  const minKey = 'checkin_setting.min_quota',
    maxKey = 'checkin_setting.max_quota'
  if (section.fields.some((field) => field.key === minKey)) {
    const min = Number(draft[minKey]),
      max = Number(draft[maxKey])
    if (
      !draft[minKey]?.trim() ||
      !draft[maxKey]?.trim() ||
      !Number.isSafeInteger(min) ||
      !Number.isSafeInteger(max) ||
      min < 0 ||
      max < min ||
      max > 2147483647
    )
      throw new Error('Invalid numeric setting')
  }
  const changes: OptionChange[] = []
  for (const field of section.fields) {
    if (field.writeOnly && !cleared.has(field.key) && !draft[field.key]) continue
    if (!cleared.has(field.key) && draft[field.key] === baseline[field.key]) continue
    let value: string | number | boolean = cleared.has(field.key) ? '' : draft[field.key]
    if (field.key === 'WorkerUrl') value = value.trim().replace(/\/+$/, '')
    if (field.key === 'TaskPublicAddress' && value && (value !== value.trim() || /[?#]/.test(value))) throw new Error('Invalid URL')
    if (field.kind === 'domains')
      value = value
        .split(/[\n,]/)
        .map((domain) => domain.trim())
        .filter(Boolean)
        .join(',')
    if (field.kind === 'json' && value.trim()) {
      const parsed: unknown = JSON.parse(value)
      validateSettingsCollection(field.key, parsed)
      value = JSON.stringify(parsed)
    }
    if (field.kind === 'boolean') value = value === 'true'
    if (field.kind === 'number') {
      const number = Number(value)
      if (
        !String(value).trim() ||
        !Number.isFinite(number) ||
        (field.min !== undefined && number < field.min) ||
        (field.exclusiveMin !== undefined && number <= field.exclusiveMin) ||
        (field.max !== undefined && number > field.max) ||
        (field.step !== 'any' && !Number.isInteger(number))
      )
        throw new Error('Invalid numeric setting')
      value = number
    }
    if (field.url && String(value).trim()) validateSettingsUrl(String(value), field.url === 'origin')
    if (field.kind === 'select' && !field.choices?.some(([choice]) => choice === value)) throw new Error('Invalid selection')
    changes.push({ key: field.key, value })
  }
  const priority = (change: OptionChange) =>
    section.finalKeys?.includes(change.key) ? (change.value === false || (change.key === 'EmailProvider' && change.value === 'smtp') ? 0 : 2) : 1
  const increaseMaxFirst = Number(draft[minKey]) > Number(baseline[maxKey])
  return changes.sort((a, b) => {
    const order = priority(a) - priority(b)
    if (order) return order
    if (increaseMaxFirst && a.key === maxKey && b.key === minKey) return -1
    if (increaseMaxFirst && a.key === minKey && b.key === maxKey) return 1
    return 0
  })
}
