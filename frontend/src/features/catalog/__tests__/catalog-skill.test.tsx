// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { CatalogSkill } from '../catalog-skill'

const markdown = '---\nname: eva-models\ndescription: Model setup\n---\nGET /v1/models\nGET /api/usage/token/\n'
const clients: QueryClient[] = []

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function renderSkill() {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CatalogSkill />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

it('copies the full Skill and gateway address without generating or including credentials', async () => {
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === '/api/status') return new Response(JSON.stringify({ success: true, data: { server_address: 'https://api.example.test' } }))
    return new Response(markdown)
  })
  vi.stubGlobal('fetch', fetchMock)
  await renderSkill()
  const button = screen.getByRole('button', { name: 'Copy full Skill' }) as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(false))
  fireEvent.click(button)
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  const copied = writeText.mock.calls[0][0]
  expect(copied).toContain(markdown)
  expect(copied).toContain('https://api.example.test/api/skills/eva-models/SKILL.md')
  expect(copied).toContain('EVA_API_KEY')
  expect(screen.getByRole('status').textContent).toBe('Copied')
  expect(fetchMock.mock.calls.map(([input]) => String(input)).sort()).toEqual(['/api/skills/eva-models/SKILL.md', '/api/status'])
})

it('rejects an HTML fallback and allows retry before enabling copy', async () => {
  let available = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/status')
        return new Response(JSON.stringify({ success: true, data: { server_address: 'https://api.example.test' } }))
      return new Response(available ? markdown : '<html>Sign in</html>')
    })
  )
  await renderSkill()
  expect(await screen.findByRole('alert')).toBeTruthy()
  const button = screen.getByRole('button', { name: 'Copy full Skill' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  available = true
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(button.disabled).toBe(false))
  expect(screen.queryByRole('alert')).toBeNull()
})
