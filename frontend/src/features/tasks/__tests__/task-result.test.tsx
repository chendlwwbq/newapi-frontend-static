// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { TaskResult } from '../task-result'
import type { TaskLog } from '../types'

const getArtifacts = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1 } } }) }))
vi.mock('@/lib/api/client', () => ({ api: getArtifacts }))
afterEach(() => {
  cleanup()
  getArtifacts.mockReset()
})

it('does not show a successful discarded-result notice for a failed task', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const task = { task_id: 'task-1', status: 'FAILURE', result_discarded: true } as TaskLog
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <TaskResult task={task} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect(screen.queryByText('Result was returned directly')).toBeNull()
  expect(getArtifacts).not.toHaveBeenCalled()
})

it('recovers a failed media preview and exposes safe legacy audio links', async () => {
  const url = `https://example.test/v1/tasks/task-1/artifacts/image/content?access=${'A'.repeat(43)}`
  getArtifacts.mockResolvedValue({
    artifacts: [{ key: 'image', type: 'image', content_url: url }],
    legacy_audio_clips: [
      { title: 'Song', audio_url: 'https://example.test/song.mp3' },
      { title: 'Unsafe', audio_url: 'javascript:alert(1)' },
    ],
  })
  const task = { task_id: 'task-1', status: 'SUCCESS' } as TaskLog
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <TaskResult task={task} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const image = await screen.findByRole('img', { name: 'image' })
  fireEvent.error(image)
  expect(screen.getByRole('alert').textContent).toContain('Media preview failed')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(screen.getByRole('img', { name: 'image' })).not.toBe(image)
  expect(screen.getByRole('link', { name: 'Download' }).getAttribute('href')).toBe('https://example.test/song.mp3')
  expect(screen.queryByText('Unsafe')).toBeNull()
})
