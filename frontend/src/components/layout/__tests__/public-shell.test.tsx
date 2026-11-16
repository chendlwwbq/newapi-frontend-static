// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicHeader, SupportDock } from '../public-shell'

vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => ({ bundle: null }) }))
vi.mock('@/lib/api/client', () => ({ api: vi.fn() }))
vi.mock('../language-switcher', () => ({ LanguageSwitcher: () => null }))
vi.mock('@/components/motion/mascot', () => ({
  Mascot: () => <button type="button">Mascot</button>,
  MascotMark: () => null,
}))

afterEach(cleanup)

it('focuses the first navigation link when the mobile menu opens', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['status'], {})
  render(
    <QueryClientProvider client={client}>
      <PublicHeader />
    </QueryClientProvider>
  )

  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

  expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Home' }))
})

it('returns focus to the mobile menu button when Escape closes the navigation', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['status'], {})
  render(
    <QueryClientProvider client={client}>
      <PublicHeader />
    </QueryClientProvider>
  )

  const toggle = screen.getByRole('button', { name: 'Open menu' })
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  screen.getByRole('link', { name: 'Home' }).focus()
  fireEvent.keyDown(window, { key: 'Escape' })

  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(toggle)
})

it('closes the mobile navigation when an account link is followed', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['status'], {})
  render(
    <QueryClientProvider client={client}>
      <PublicHeader />
    </QueryClientProvider>
  )

  const toggle = screen.getByRole('button', { name: 'Open menu' })
  fireEvent.click(toggle)
  const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(navigation).getByRole('button', { name: 'Toggle theme' })).toBeTruthy()
  expect(within(navigation).getByRole('link', { name: 'Notifications' })).toBeTruthy()
  fireEvent.click(within(navigation).getByRole('link', { name: 'Sign in' }))

  expect(toggle.getAttribute('aria-expanded')).toBe('false')
})

it('does not leave an invisible documentation link in the support dock tab order', () => {
  render(<SupportDock />)
  expect(screen.queryByRole('link', { name: 'Docs' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Mascot' })).toBeTruthy()
})
