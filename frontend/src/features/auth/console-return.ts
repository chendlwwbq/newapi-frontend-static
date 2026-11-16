/** Keep the route selection needed by the key-creation flow without forwarding unrelated query values. */
export function consoleReturnPath(path: string, search: string) {
  if (path !== '/keys') return path
  const source = new URLSearchParams(search)
  if (source.get('create') !== '1') return path
  const target = new URLSearchParams({ create: '1' })
  const group = source.get('group')
  if (group) target.set('group', group)
  return `${path}?${target}`
}
