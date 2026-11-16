import type { ContentPart } from '../types'

export function imageUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return value.trim()
  } catch {
    return null
  }
}

export function messageContent(text: string, images: string[] = []): string | ContentPart[] {
  if (!images.length) return text
  return [...(text ? [{ type: 'text' as const, text }] : []), ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } }))]
}
