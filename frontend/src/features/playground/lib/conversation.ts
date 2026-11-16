import type { ChatCompletionMessage } from '../types'
import { messageContent } from './image-messages'
import type { PdfAttachment } from './backup'

type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  pdf?: PdfAttachment
  status?: 'streaming' | 'complete' | 'stopped' | 'error'
}

export function branchEditedMessage<T extends ConversationMessage & { id: string }>(history: T[], id: string, content: string): T[] | null {
  const index = history.findIndex((message) => message.id === id)
  if (index < 0 || history[index].role !== 'user') return null
  return [...history.slice(0, index), { ...history[index], content }]
}

export function playgroundMessages(history: ConversationMessage[], system: string): ChatCompletionMessage[] {
  const messages: ChatCompletionMessage[] = []
  if (system.trim()) messages.push({ role: 'system', content: system.trim() })
  for (const message of history) {
    if (message.status === 'error' || (message.role === 'assistant' && !message.content.trim())) continue
    const content = messageContent(message.content, message.role === 'user' ? message.images : undefined)
    if (message.role === 'user' && message.pdf) {
      const parts = typeof content === 'string' ? (content ? [{ type: 'text' as const, text: content }] : []) : content
      messages.push({ role: message.role, content: [...parts, { type: 'file', file: { filename: message.pdf.name, file_data: message.pdf.data } }] })
    } else messages.push({ role: message.role, content })
  }
  return messages
}
