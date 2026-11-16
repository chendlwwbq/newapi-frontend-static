import { expect, it } from 'vitest'
import { parsePlaygroundBackup } from '../lib/backup'
import { playgroundMessages } from '../lib/conversation'

it('restores PDF attachments and includes them in regenerated chat requests', () => {
  const pdf = { name: 'report.pdf', data: 'data:application/pdf;base64,JVBERi0=' }
  const backup = {
    version: 1,
    conversations: [{ id: 'chat', title: 'Report', updatedAt: 1, messages: [{ role: 'user', content: 'Read this', pdf }] }],
    draft: { text: '', images: [], imageUrl: '' },
  }
  const imported = parsePlaygroundBackup(JSON.stringify(backup))
  expect(imported.conversations[0].messages[0].pdf).toEqual(pdf)
  expect(playgroundMessages(imported.conversations[0].messages, '')).toEqual([
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Read this' },
        { type: 'file', file: { filename: 'report.pdf', file_data: pdf.data } },
      ],
    },
  ])
})

it('restores conversations, images and drafts with new independent IDs', () => {
  const original = {
    version: 1,
    activeId: 'old',
    conversations: [
      {
        id: 'old',
        title: 'Chat',
        updatedAt: 1,
        messages: [
          { id: 'message', role: 'user', content: 'Question', images: ['data:image/png;base64,aW1hZ2U='] },
          { id: 'reply', role: 'assistant', content: '', status: 'streaming' },
        ],
      },
    ],
    draft: { text: 'draft', images: ['https://example.com/image.png'], imageUrl: '' },
  }
  const imported = parsePlaygroundBackup(JSON.stringify(original))
  expect(imported.conversations[0].id).not.toBe('old')
  expect(imported.activeId).toBe(imported.conversations[0].id)
  expect(imported.conversations[0].messages[0].id).not.toBe('message')
  expect(imported.conversations[0].messages[0].images).toEqual(['data:image/png;base64,aW1hZ2U='])
  expect(imported.conversations[0].messages[1].status).toBe('stopped')
  expect(imported.draft).toEqual(original.draft)
})

it('rejects a backup that points to a missing or ambiguous active conversation', () => {
  const chat = { id: 'old', title: 'Chat', updatedAt: 1, messages: [] }
  const draft = { text: 'draft', images: [], imageUrl: '' }
  expect(() => parsePlaygroundBackup(JSON.stringify({ version: 1, activeId: 'missing', conversations: [chat], draft }))).toThrow()
  expect(() => parsePlaygroundBackup(JSON.stringify({ version: 1, activeId: 'old', conversations: [chat, chat], draft }))).toThrow()
})

it('treats older backups without an active conversation as a new draft', () => {
  const imported = parsePlaygroundBackup(JSON.stringify({ version: 1, conversations: [], draft: { text: 'draft', images: [], imageUrl: '' } }))
  expect(imported.activeId).toBe('')
})

it('maps other conversation drafts to their imported copies and retains a separate new-chat draft', () => {
  const chat = (id: string) => ({ id, title: id, updatedAt: 1, messages: [] })
  const draft = (text: string) => ({ text, images: [], imageUrl: '' })
  const imported = parsePlaygroundBackup(
    JSON.stringify({
      version: 1,
      activeId: 'a',
      conversations: [chat('a'), chat('b')],
      draft: draft('current'),
      backgroundDrafts: [
        { conversationId: 'b', draft: draft('other') },
        { conversationId: '', draft: draft('new chat') },
      ],
    })
  )
  expect(imported.backgroundDrafts).toEqual([
    { conversationId: imported.conversations[1].id, draft: draft('other') },
    { conversationId: '', draft: draft('new chat') },
  ])
})

it('rejects background drafts referencing missing, duplicate or active conversations', () => {
  const draft = { text: 'x', images: [], imageUrl: '' },
    chat = { id: 'a', title: 'a', updatedAt: 1, messages: [] }
  for (const backgroundDrafts of [
    [{ conversationId: 'missing', draft }],
    [{ conversationId: 'a', draft }],
    [
      { conversationId: '', draft },
      { conversationId: '', draft },
    ],
  ]) {
    expect(() => parsePlaygroundBackup(JSON.stringify({ version: 1, activeId: 'a', conversations: [chat], draft, backgroundDrafts }))).toThrow()
  }
})

it('rejects malformed backups, unsupported image sources and unknown versions', () => {
  for (const value of [
    '{}',
    '{',
    JSON.stringify({ version: 2, conversations: [], draft: {} }),
    JSON.stringify({
      version: 1,
      conversations: [{ title: 'x', updatedAt: 1, messages: [{ role: 'user', content: 'x', images: ['javascript:alert(1)'] }] }],
      draft: { text: '', images: [], imageUrl: '' },
    }),
  ]) {
    expect(() => parsePlaygroundBackup(value)).toThrow()
  }
})
