import { freshAuthHeaders } from '@/lib/auth/session'
import { ApiError } from '@/lib/api/client'

type UploadedText = { id: string; size: number }

export async function uploadTextAttachment(file: File): Promise<UploadedText> {
  const response = await fetch('/api/playground/uploads/files', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain; charset=utf-8',
      ...(await freshAuthHeaders()),
    },
    body: file,
  })
  const result = await response.json()
  if (!response.ok || !result.success) throw new ApiError(result.message || response.statusText, response.status)
  return result.data as UploadedText
}

export async function readTextAttachment(id: string): Promise<string> {
  const response = await fetch(`/api/playground/uploads/files/${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: await freshAuthHeaders(),
  })
  if (!response.ok) throw new ApiError(response.statusText, response.status)
  return response.text()
}

export async function deleteTextAttachment(id: string): Promise<void> {
  const response = await fetch(`/api/playground/uploads/files/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: await freshAuthHeaders(),
  })
  // An expired or already-cleaned attachment no longer needs deletion.
  if (!response.ok && response.status !== 404) throw new ApiError(response.statusText, response.status)
}

/** Compose plain-text attachments as ordinary user message content. */
export async function messageWithTextAttachments(message: string, attachments: { id: string; name: string }[]): Promise<string> {
  const content = await Promise.all(
    attachments.map(async (attachment) => ({
      name: attachment.name,
      text: await readTextAttachment(attachment.id),
    }))
  )
  if (!content.length) return message
  return `${message}\n\n${content.map((file) => `Attachment ${JSON.stringify(file.name)}:\n${file.text}`).join('\n\n')}`.trim()
}

export async function readPdfAttachment(id: string): Promise<string> {
  const response = await fetch(`/api/playground/uploads/files/${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: await freshAuthHeaders(),
  })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('application/pdf'))
    throw new ApiError(response.statusText || 'Invalid PDF', response.status)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid PDF')))
    reader.onerror = () => reject(new Error('Invalid PDF'))
    reader.readAsDataURL(blob)
  })
}
