function canonicalJSON(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJSON)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalJSON(item)])
    )
  return value
}
export function changedMetadataFields(before: object, after: object): string[] {
  const left = before as Record<string, unknown>,
    right = after as Record<string, unknown>
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .sort()
    .filter((key) => JSON.stringify(canonicalJSON(left[key])) !== JSON.stringify(canonicalJSON(right[key])))
}
