// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { AuditPage } from '../audit-page'

const request = vi.hoisted(() => vi.fn())
const auth = vi.hoisted(() => ({ role: 10, canReadAll: false }))
vi.mock('@/lib/auth/session', () => ({
  useAuth: () => ({ bundle: { user: { id: 1, role: auth.role, permissions: { admin_permissions: { audit: { read: auth.canReadAll } } } } } }),
}))
vi.mock('@/lib/api/client', () => ({ api: request }))

afterEach(() => {
  cleanup()
  request.mockReset()
  auth.role = 10
  auth.canReadAll = false
})

async function renderAudit() {
  request.mockResolvedValue({ items: [], total: 60 })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <AuditPage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByRole('button', { name: 'Next' })
}

it.each([
  { role: 1, permission: false, visible: false },
  { role: 10, permission: false, visible: false },
  { role: 10, permission: true, visible: true },
  { role: 100, permission: false, visible: true },
])('shows the all-records option for role $role with audit permission $permission: $visible', async ({ role, permission, visible }) => {
  auth.role = role
  auth.canReadAll = permission
  await renderAudit()
  fireEvent.click(screen.getByRole('combobox', { name: 'Scope' }))
  await screen.findByRole('option', { name: 'My audit records' })
  expect(!!screen.queryByRole('option', { name: 'All audit records' })).toBe(visible)
})

it('applies category and failed-result filters only on Search and clears them on Reset', async () => {
  await renderAudit()
  fireEvent.click(screen.getByRole('combobox', { name: 'Category' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Operation' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Result' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Failed' }))
  expect(String(request.mock.lastCall?.[0])).not.toContain('category=')
  expect(String(request.mock.lastCall?.[0])).not.toContain('success=')
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() =>
    expect(Object.fromEntries(new URLSearchParams(String(request.mock.lastCall?.[0]).split('?')[1]))).toMatchObject({
      category: 'operation',
      success: 'false',
      p: '1',
    })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByRole('combobox', { name: 'Category' }).textContent).toBe('All')
  expect(screen.getByRole('combobox', { name: 'Result' }).textContent).toBe('All')
  await waitFor(() => expect(String(request.mock.lastCall?.[0])).not.toMatch(/category=|success=/))
})

it('switching audit scope resets pagination and preserves applied filters', async () => {
  auth.canReadAll = true
  await renderAudit()
  fireEvent.click(screen.getByRole('combobox', { name: 'Result' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Success' }))
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(String(request.mock.lastCall?.[0])).toContain('success=true'))
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await waitFor(() => expect(String(request.mock.lastCall?.[0])).toContain('p=2'))
  fireEvent.click(screen.getByRole('combobox', { name: 'Scope' }))
  fireEvent.click(await screen.findByRole('option', { name: 'All audit records' }))
  await waitFor(() => expect(String(request.mock.lastCall?.[0])).toMatch(/^\/api\/audit\?p=1&.*success=true/))
  expect(screen.getByLabelText('Username')).toBeTruthy()
  expect((await screen.findByRole('columnheader', { name: 'Details' })).className).toContain('table-sticky-action')
})
