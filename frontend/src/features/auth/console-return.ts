export function safeInternalPath(value?: string | null): string | undefined {
  // Reject controls before URL parsing can silently remove them.
  // eslint-disable-next-line no-control-regex
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(value)) return undefined
  try {
    const url = new URL(value, 'http://localhost')
    // Normalizing dot segments can itself produce a protocol-relative path.
    if (url.origin !== 'http://localhost' || url.pathname.startsWith('//')) return undefined
    return url.pathname + url.search + url.hash
  } catch {
    return undefined
  }
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
