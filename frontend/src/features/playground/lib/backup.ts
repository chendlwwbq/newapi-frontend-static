import { imageUrl } from './image-messages'

export type PdfAttachment = { name: string; data: string }
export type ChatMessage = {
  pdf?: PdfAttachment
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  reasoning?: string
  status?: 'streaming' | 'complete' | 'stopped' | 'error'
  error?: string
}
export type Conversation = { id: string; title: string; messages: ChatMessage[]; updatedAt: number }
export type ConversationDraft = { text: string; images: string[]; imageUrl: string }
export type PlaygroundBackup = {
  conversations: Conversation[]
  activeId: string
  draft: ConversationDraft
  backgroundDrafts: { conversationId: string; draft: ConversationDraft }[]
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup')
  return value as Record<string, unknown>
}

function images(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) => typeof item === 'string' && (imageUrl(item) !== null || /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(item))
    )
  )
    throw new Error('Invalid backup')
  return value as string[]
}

function readDraft(value: unknown): ConversationDraft {
  const draft = object(value)
  if (typeof draft.text !== 'string' || typeof draft.imageUrl !== 'string') throw new Error('Invalid backup')
  return { text: draft.text, images: images(draft.images), imageUrl: draft.imageUrl }
}

export function parsePlaygroundBackup(source: string): PlaygroundBackup {
  const backup = object(JSON.parse(source))
  if (backup.version !== 1 || !Array.isArray(backup.conversations)) throw new Error('Invalid backup')
  if (backup.activeId !== undefined && typeof backup.activeId !== 'string') throw new Error('Invalid backup')
  const ids = new Map<string, string>()
  const conversations = backup.conversations.map((item) => {
    const row = object(item)
    if (typeof row.title !== 'string' || typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt) || !Array.isArray(row.messages))
      throw new Error('Invalid backup')
    const id = crypto.randomUUID()
    if (typeof row.id === 'string' && row.id) {
      if (ids.has(row.id)) throw new Error('Invalid backup')
      ids.set(row.id, id)
    }
    const messages: ChatMessage[] = row.messages.map((item) => {
      const message = object(item)
      if (
        (message.role !== 'user' && message.role !== 'assistant') ||
        typeof message.content !== 'string' ||
        (message.reasoning !== undefined && typeof message.reasoning !== 'string') ||
        (message.error !== undefined && typeof message.error !== 'string') ||
        (message.status !== undefined && !['streaming', 'complete', 'stopped', 'error'].includes(String(message.status)))
      )
        throw new Error('Invalid backup')
      let pdf: PdfAttachment | undefined
      if (message.pdf !== undefined) {
        const value = object(message.pdf)
        if (
          message.role !== 'user' ||
          typeof value.name !== 'string' ||
          typeof value.data !== 'string' ||
          !/^data:application\/pdf;base64,[a-z0-9+/]+={0,2}$/i.test(value.data)
        )
          throw new Error('Invalid backup')
        pdf = { name: value.name, data: value.data }
      }
      return {
        id: crypto.randomUUID(),
        role: message.role,
        content: message.content,
        ...(pdf ? { pdf } : {}),
        ...(message.images !== undefined ? { images: images(message.images) } : {}),
        ...(typeof message.reasoning === 'string' ? { reasoning: message.reasoning } : {}),
        ...(typeof message.error === 'string' ? { error: message.error } : {}),
        ...(message.status ? { status: message.status === 'streaming' ? ('stopped' as const) : (message.status as ChatMessage['status']) } : {}),
      }
    })
    return { id, title: row.title, messages, updatedAt: row.updatedAt }
  })
  const activeId = typeof backup.activeId === 'string' && backup.activeId ? ids.get(backup.activeId) : ''
  if (activeId === undefined) throw new Error('Invalid backup')
  if (backup.backgroundDrafts !== undefined && !Array.isArray(backup.backgroundDrafts)) throw new Error('Invalid backup')
  const seen = new Set<string>()
  const backgroundDrafts = (backup.backgroundDrafts || []).map((value) => {
    const entry = object(value)
    if (typeof entry.conversationId !== 'string' || seen.has(entry.conversationId) || entry.conversationId === (backup.activeId || ''))
      throw new Error('Invalid backup')
    seen.add(entry.conversationId)
    const conversationId = entry.conversationId ? ids.get(entry.conversationId) : ''
    if (conversationId === undefined) throw new Error('Invalid backup')
    return { conversationId, draft: readDraft(entry.draft) }
  })
  return { conversations, activeId, draft: readDraft(backup.draft), backgroundDrafts }
}
