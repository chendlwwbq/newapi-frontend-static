import { afterEach, expect, it, vi } from 'vitest'
import {
  deleteTextAttachment,
  messageWithTextAttachments,
  readPdfAttachment,
  readTextAttachment,
  uploadTextAttachment,
} from '../lib/text-attachments'

vi.mock('@/lib/auth/session', () => ({ freshAuthHeaders: async () => ({ Authorization: 'Bearer test' }) }))
afterEach(() => vi.unstubAllGlobals())

it('uploads and reads private text using the authenticated attachment endpoints', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: 'abc', size: 5 } }), { status: 200 }))
    .mockResolvedValueOnce(new Response('hello', { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetcher)
  const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
  expect(await uploadTextAttachment(file)).toEqual({ id: 'abc', size: 5 })
  expect(fetcher.mock.calls[0][1].body).toBe(file)
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test')
  expect(await readTextAttachment('abc')).toBe('hello')
  await deleteTextAttachment('abc')
  expect(fetcher.mock.calls[2][1].method).toBe('DELETE')
})

it('does not treat a failed attachment read as content', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
  await expect(readTextAttachment('missing')).rejects.toThrow()
})

it('allows removal of a draft whose attachment has already expired', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
  await expect(deleteTextAttachment('expired')).resolves.toBeUndefined()
})

it('includes attachment contents in the message sent to the model', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('file text', { status: 200 })))
  await expect(messageWithTextAttachments('Summarize', [{ id: 'abc', name: 'notes.txt' }])).resolves.toBe(
    'Summarize\n\nAttachment "notes.txt":\nfile text'
  )
})

it('uploads a PDF with its actual content type', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 'pdf', size: 5 } }), { status: 200 }))
  vi.stubGlobal('fetch', fetcher)
  await uploadTextAttachment(new File(['%PDF-'], 'file.pdf', { type: 'application/pdf' }))
  expect(fetcher.mock.calls[0][1].headers['Content-Type']).toBe('application/pdf')
})

it('rejects a non-PDF response before it reaches the model', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not a pdf', { status: 200, headers: { 'Content-Type': 'text/plain' } })))
  await expect(readPdfAttachment('pdf')).rejects.toThrow()
})
