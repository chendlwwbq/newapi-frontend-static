// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { TasksPage } from '../tasks-page'

vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: { user: { id: 1, role: 100 } } }) }))
vi.mock('@/lib/format', () => ({ useQuotaFormatter: () => String, formatNumber: String }))
vi.mock('@/lib/api/client', () => ({
  api: async () => ({
    total: 1,
    items: [
      {
        id: 1,
        task_id: 'task-1',
        user_id: 2,
        username: 'user',
        channel_id: 3,
        platform: 'test',
        action: 'GENERATE',
        group: 'default',
        status: 'IN_PROGRESS',
        progress: '60%',
        quota: 1,
        submit_time: 1,
        properties: { origin_model_name: 'requested', upstream_model_name: 'actual' },
        admin_info: { request_id: 'request-1', request_path: '/v1/videos' },
      },
    ],
  }),
}))
afterEach(cleanup)

it('shows progress, actual model and admin request details for a task', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <TasksPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('combobox', { name: 'Scope' }))
  fireEvent.click(await screen.findByRole('option', { name: 'All records' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Details' }))
  const dialog = await screen.findByRole('dialog')
  for (const text of ['60%', 'actual', 'request-1', '/v1/videos']) expect(within(dialog).getByText(text)).toBeTruthy()
})
