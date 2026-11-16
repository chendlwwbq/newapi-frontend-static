/** A standalone HTTPS URL is the native home-page frame mode. */
export function homeFrameURL(source: string) {
  const value = source.trim()
  if (!/^https:\/\/\S+$/.test(value)) return null
  try {
    const url = new URL(value)
    return url.username || url.password ? null : url.href
  } catch {
    return null
  }
}
