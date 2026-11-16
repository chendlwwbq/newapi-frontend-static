// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { DocsPage } from '../docs-page'

vi.mock('../api-reference', () => ({ ApiReference: () => null }))
vi.mock('../use-gateway-address', () => ({
  useGatewayAddress: () => ({ address: 'https://gateway.test', error: null, retry: vi.fn() }),
}))

afterEach(cleanup)

it('keeps the mobile documentation navigation collapsed until requested and closes it after navigation', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <DocsPage slug="claude-code" />
    </I18nextProvider>
  )

  const toggle = screen.getByRole('button', { name: 'Claude Code' })
  const navigation = document.getElementById('docs-navigation')
  expect(toggle.getAttribute('type')).toBe('button')
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(navigation?.classList.contains('is-open')).toBe(false)
  expect(screen.getByRole('link', { name: 'Claude Code' }).getAttribute('aria-current')).toBe('page')

  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(navigation?.classList.contains('is-open')).toBe(true)

  const cursor = screen.getByRole('link', { name: 'Cursor' })
  expect(cursor.getAttribute('href')).toBe('/docs/cursor')
  fireEvent.click(cursor)
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(navigation?.classList.contains('is-open')).toBe(false)
})
