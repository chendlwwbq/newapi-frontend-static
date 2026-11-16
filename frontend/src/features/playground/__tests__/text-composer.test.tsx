// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { PlaygroundPage } from '../playground-page'

const { send, upload, read, remove, readPdf } = vi.hoisted(() => ({
  send: vi.fn(),
  upload: vi.fn(),
  read: vi.fn(),
  remove: vi.fn(),
  readPdf: vi.fn(),
}))
const uploadConfig = vi.hoisted(() => ({ fail: false, groupFail: false, modelUrls: [] as string[] }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, group: 'default' } } }) }))
vi.mock('@/lib/api/client', () => ({
  api: async (url: string) => {
    if (url.includes('/uploads/config')) {
      if (uploadConfig.fail) throw new Error('Network error')
      return { text_upload_enabled: true, max_bytes: 10485760 }
    }
    if (url.includes('/groups')) {
      if (uploadConfig.groupFail) throw new Error('Group unavailable')
      return { default: { desc: '', ratio: 1 } }
    }
    uploadConfig.modelUrls.push(url)
    return ['test-model']
  },
}))
vi.mock('../hooks/use-stream-request', () => ({ useStreamRequest: () => ({ sendStreamRequest: send, stopStream: vi.fn() }) }))
vi.mock('../lib/text-attachments', () => ({
  uploadTextAttachment: upload,
  messageWithTextAttachments: read,
  deleteTextAttachment: remove,
  readPdfAttachment: readPdf,
}))
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.resetAllMocks()
  uploadConfig.fail = false
  uploadConfig.groupFail = false
  uploadConfig.modelUrls = []
})

it('keeps model, group and generation settings available beside the composer', async () => {
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
  expect(screen.getByRole('combobox', { name: 'Group' })).toBeTruthy()
  expect(screen.getByRole('combobox', { name: 'Model' })).toBeTruthy()
  expect(await screen.findByRole('heading', { name: 'Chat with test-model' })).toBeTruthy()
  expect(screen.getByText('Current group · default')).toBeTruthy()
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Group' }).closest('form')).toBe(screen.getByRole('textbox', { name: 'Message' }).closest('form'))
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generation settings' }))
  expect(screen.getByRole('dialog', { name: 'Generation settings' })).toBeTruthy()
  expect(send).not.toHaveBeenCalled()
})

it('retries group loading before requesting models for the recovered group', async () => {
  uploadConfig.groupFail = true
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
  await screen.findByText('Group unavailable')
  uploadConfig.groupFail = false
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.getByRole('option', { name: 'test-model' })).toBeTruthy())
  expect(uploadConfig.modelUrls).toEqual(['/api/user/models?group=default'])
})

it('allows retrying attachment configuration after a failed request', async () => {
  uploadConfig.fail = true
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
  await screen.findByText('Network error')
  uploadConfig.fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByLabelText('Upload text file')).toBeTruthy()
})

it('uploads a text file and sends its contents as the user message', async () => {
  upload.mockResolvedValue({ id: 'file-id', size: 4 })
  read.mockResolvedValue('Summarize\n\nAttachment "notes.txt":\ntext')
  remove.mockResolvedValue(undefined)
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
  expect(screen.getByRole('heading', { name: 'Playground' })).toBeTruthy()
  await waitFor(() => expect((screen.getByLabelText('Upload text file') as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Upload text file'), { target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] } })
  await screen.findByText('notes.txt')
  expect((screen.getByRole('button', { name: 'Export' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getAllByRole('button', { name: 'New conversation' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Summarize' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(send).toHaveBeenCalledOnce())
  expect(read).toHaveBeenCalledWith('Summarize', [{ id: 'file-id', name: 'notes.txt', kind: 'text' }])
  expect(remove).toHaveBeenCalledWith('file-id')
  expect(send.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'Summarize\n\nAttachment "notes.txt":\ntext' }])
})

it('keeps the draft when reading the attachment fails', async () => {
  upload.mockResolvedValue({ id: 'file-id', size: 4 })
  read.mockRejectedValue(new Error('unavailable'))
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
  await waitFor(() => expect((screen.getByLabelText('Upload text file') as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Upload text file'), { target: { files: [new File(['text'], 'notes.txt')] } })
  await screen.findByText('notes.txt')
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Summarize' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(read).toHaveBeenCalledOnce())
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Summarize')
  expect(screen.getByText('notes.txt')).toBeTruthy()
  expect(send).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it('sends the attachment when temporary file deletion fails', async () => {
  upload.mockResolvedValue({ id: 'file-id', size: 4 })
  read.mockResolvedValue('Attachment "notes.txt":\ntext')
  remove.mockRejectedValue(new Error('unavailable'))
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
  await waitFor(() => expect((screen.getByLabelText('Upload text file') as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Upload text file'), { target: { files: [new File(['text'], 'notes.txt')] } })
  await screen.findByText('notes.txt')
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(send).toHaveBeenCalledOnce())
  expect(remove).toHaveBeenCalledWith('file-id')
  expect(send.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'Attachment "notes.txt":\ntext' }])
})

it('does not upload an empty file', async () => {
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
  await waitFor(() => expect((screen.getByLabelText('Upload text file') as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Upload text file'), { target: { files: [new File([], 'empty.txt')] } })
  expect(upload).not.toHaveBeenCalled()
})

it('sends an uploaded PDF as a file part', async () => {
  upload.mockResolvedValue({ id: 'pdf-id', size: 5 })
  readPdf.mockResolvedValue('data:application/pdf;base64,JVBERi0=')
  remove.mockResolvedValue(undefined)
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
  await waitFor(() => expect((screen.getByLabelText('Upload PDF') as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Upload PDF'), { target: { files: [new File(['%PDF-'], 'doc.pdf', { type: 'application/pdf' })] } })
  await screen.findByText('doc.pdf')
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(send).toHaveBeenCalledOnce())
  expect(send.mock.calls[0][0].messages).toEqual([
    { role: 'user', content: [{ type: 'file', file: { filename: 'doc.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' } }] },
  ])
})

it('does not upload large text files when only local storage is available', async () => {
  vi.stubGlobal('indexedDB', undefined)
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
  await waitFor(() => expect((screen.getByLabelText('Upload text file') as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Upload text file'), { target: { files: [new File([new Uint8Array(512 * 1024 + 1)], 'large.txt')] } })
  expect(upload).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
