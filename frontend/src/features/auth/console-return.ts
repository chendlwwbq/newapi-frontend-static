export function safeInternalPath(value?: string | null): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

/** Keep the route selection needed by the key-creation flow without forwarding unrelated query values. */
export function consoleReturnPath(path: string, search: string) {
  if (path !== '/keys') return path
  const source = new URLSearchParams(search)
  if (source.get('create') !== '1') return path
  const target = new URLSearchParams({ create: '1' })
  const group = source.get('group')
  if (group) target.set('group', group)
  const returnTo = safeInternalPath(source.get('returnTo'))
  if (returnTo) target.set('returnTo', returnTo)
  return `${path}?${target}`
}
