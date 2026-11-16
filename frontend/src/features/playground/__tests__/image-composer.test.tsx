// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { IDBFactory } from 'fake-indexeddb'
import { PlaygroundPage } from '../playground-page'
import { loadConversationHistory, saveConversationHistory } from '../lib/history-storage'

const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, group: 'default' } } }) }))
vi.mock('@/lib/api/client', () => ({ api: async (url: string) => (url.includes('/groups') ? { default: { desc: '', ratio: 1 } } : ['test-model']) }))
vi.mock('../hooks/use-stream-request', () => ({ useStreamRequest: () => ({ sendStreamRequest: send, stopStream: vi.fn() }) }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  send.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('sends a selected local image through the native multimodal chat request', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Model' }) as HTMLSelectElement).value).toBe('test-model'))
  const menu = screen.getByLabelText('Attach file')
  fireEvent.click(menu)
  expect(menu.closest('details')?.open).toBe(true)
  const file = new File(['image'], 'photo.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
  await screen.findByRole('img', { name: 'Local image 1' })
  expect(menu.closest('details')?.open).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(send).toHaveBeenCalledOnce())
  expect(send.mock.calls[0][0].messages).toEqual([
    { role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2U=' } }] },
  ])
})

it('persists the question and image while the response is still being generated', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Model' }) as HTMLSelectElement).value).toBe('test-model'))
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Describe this' } })
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } })
  await screen.findByRole('img', { name: 'Local image 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(async () => {
    const history = await loadConversationHistory<{ messages: { content: string; images?: string[]; status?: string }[] }>('new-api:playground:1')
    expect(history.conversations[0]?.messages[0]).toMatchObject({ content: 'Describe this', images: ['data:image/png;base64,aW1hZ2U='] })
    expect(history.conversations[0]?.messages[1].status).toBe('stopped')
  })
})

it('shows a validation error and keeps sending disabled for an unsupported image', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const file = new File(['image'], 'photo.svg', { type: 'image/svg+xml' })
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
  expect((await screen.findByRole('alert')).textContent).toContain('Choose a JPEG, PNG, WebP or GIF image up to 512 KB.')
  expect((screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled).toBe(true)
  expect(send).not.toHaveBeenCalled()
})

it('accepts a pasted image and sends it with the message', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Model' }) as HTMLSelectElement).value).toBe('test-model'))
  const file = new File(['image'], 'paste.png', { type: 'image/png' })
  fireEvent.paste(screen.getByLabelText('Message'), { clipboardData: { files: [file], getData: () => '' } })
  await screen.findByRole('img', { name: 'Local image 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(send).toHaveBeenCalledOnce())
  expect(send.mock.calls[0][0].messages[0].content).toEqual([{ type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2U=' } }])
})

it('accepts a photo above 512 KB when IndexedDB history is available', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect((screen.getByLabelText('Upload photo') as HTMLInputElement).disabled).toBe(false))
  const file = new File([new Uint8Array(512 * 1024 + 1)], 'photo.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
  expect((await screen.findByRole('img', { name: 'Local image 1' })).getAttribute('src')).toMatch(/^data:image\/png;base64,/)
})

it('warns when conversation history cannot be loaded without overwriting the previous record', async () => {
  vi.stubGlobal('indexedDB', {
    open: () => {
      throw new Error('blocked')
    },
  })
  localStorage.setItem('new-api:playground:1', '[{"id":"old"}]')
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect((await screen.findByRole('alert')).textContent).toContain('Conversation history is unavailable or could not be saved on this device.')
  expect(localStorage.getItem('new-api:playground:1')).toBe('[{"id":"old"}]')
})

it('clears a migrated conversation and its old local-storage copy after confirmation', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.setItem('new-api:playground:1', JSON.stringify([{ id: 'old', title: 'Old chat', messages: [], updatedAt: 1 }]))
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByRole('button', { name: 'Old chat' })
  fireEvent.click(screen.getByRole('button', { name: 'Clear history' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear history' }))
  await waitFor(() => expect(localStorage.getItem('new-api:playground:1')).toBeNull())
  expect((await loadConversationHistory('new-api:playground:1')).conversations).toEqual([])
})

it('warns about a concurrent history update without replacing it', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect((screen.getByLabelText('Message') as HTMLTextAreaElement).disabled).toBe(false))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Model' }) as HTMLSelectElement).value).toBe('test-model'))
  await saveConversationHistory('new-api:playground:1', [{ id: 'other-tab' }], 'indexeddb', 0)
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Unsaved question' } })
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } })
  await screen.findByRole('img', { name: 'Local image 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  expect((await screen.findByRole('alert')).textContent).toContain('History changed in another tab')
  expect((await loadConversationHistory<{ id: string }>('new-api:playground:1')).conversations).toEqual([{ id: 'other-tab' }])
  expect(within(screen.getByRole('log', { name: 'Conversation' })).getByText('Unsaved question')).toBeTruthy()
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Draft text' } })
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  const blob = createUrl.mock.calls[0][0] as Blob
  const data = JSON.parse(await blob.text())
  expect(data.conversations[0].messages[0].content).toBe('Unsaved question')
  expect(data.conversations[0].messages[0].images).toEqual(['data:image/png;base64,aW1hZ2U='])
  expect(data.activeId).toBe(data.conversations[0].id)
  expect(data.draft.text).toBe('Draft text')
})

it('imports backup conversations and draft without replacing existing history', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.setItem('new-api:playground:1', JSON.stringify([{ id: 'old', title: 'Existing chat', messages: [], updatedAt: 1 }]))
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByRole('button', { name: 'Existing chat' })
  fireEvent.click(screen.getByRole('button', { name: 'Import' }))
  const dialog = await screen.findByRole('dialog')
  const backup = {
    version: 1,
    activeId: 'old',
    conversations: [
      { id: 'old', title: 'Imported chat', messages: [{ id: 'm', role: 'user', content: 'Recovered' }], updatedAt: 2 },
      { id: 'other', title: 'Imported second', messages: [], updatedAt: 1 },
    ],
    draft: { text: 'Recovered draft', images: [], imageUrl: '' },
    backgroundDrafts: [
      { conversationId: 'other', draft: { text: 'Second recovered draft', images: [], imageUrl: '' } },
      { conversationId: '', draft: { text: 'Recovered new-chat draft', images: [], imageUrl: '' } },
    ],
  }
  fireEvent.change(within(dialog).getByLabelText('JSON file'), {
    target: { files: [new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' })] },
  })
  await waitFor(() => expect((within(dialog).getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
  expect(await screen.findByRole('button', { name: 'Imported chat' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Existing chat' })).toBeTruthy()
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Recovered draft')
  expect(within(screen.getByRole('log', { name: 'Conversation' })).getByText('Recovered')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Imported second' }))
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Second recovered draft')
  fireEvent.click(screen.getByRole('button', { name: 'Imported chat' }))
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Recovered draft')
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Conversations' })).getByRole('button', { name: 'New conversation' }))
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Recovered new-chat draft')
})

it('blocks restoration of a backup draft until the existing draft is cleared', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await waitFor(() => expect((screen.getByLabelText('Message') as HTMLTextAreaElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Current draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Import' }))
  const dialog = await screen.findByRole('dialog')
  const backup = { version: 1, conversations: [], draft: { text: 'Backup draft', images: [], imageUrl: '' } }
  fireEvent.change(within(dialog).getByLabelText('JSON file'), {
    target: { files: [new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' })] },
  })
  expect((await within(dialog).findByRole('alert')).textContent).toContain('Clear the current draft')
  expect((within(dialog).getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Current draft')
})

it('keeps separate unsent text and pictures when switching conversations', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.setItem(
    'new-api:playground:1',
    JSON.stringify([
      { id: 'first', title: 'First chat', messages: [], updatedAt: 2 },
      { id: 'second', title: 'Second chat', messages: [], updatedAt: 1 },
    ])
  )
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PlaygroundPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByRole('button', { name: 'First chat' })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'First draft' } })
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } })
  await screen.findByRole('img', { name: 'Local image 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Second chat' }))
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('')
  expect(screen.queryByRole('img', { name: 'Local image 1' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Second draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'First chat' }))
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('First draft')
  expect(screen.getByRole('img', { name: 'Local image 1' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Second chat' }))
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Second draft')
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  const data = JSON.parse(await (createUrl.mock.calls[0][0] as Blob).text())
  expect(data.backgroundDrafts).toContainEqual({
    conversationId: 'first',
    draft: { text: 'First draft', images: ['data:image/png;base64,aW1hZ2U='], imageUrl: '' },
  })
})
