// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import NotFound from '../not-found'

vi.mock('@/components/layout/public-shell', () => ({ Brand: () => <a href="/">eva</a> }))
vi.mock('@/components/motion/mascot', () => ({ Mascot: () => <span>eva mascot</span> }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('offers home, model and help links and a back action for an unknown page', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
  render(
    <I18nextProvider i18n={i18n}>
      <NotFound />
    </I18nextProvider>
  )
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
  expect(screen.getByText('The link may have expired or the page may have moved.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Return home' }).getAttribute('href')).toBe('/')
  expect(screen.getByRole('link', { name: 'Models' }).getAttribute('href')).toBe('/pricing')
  expect(screen.getByRole('link', { name: 'Help center' }).getAttribute('href')).toBe('/docs')
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(back).toHaveBeenCalledOnce()
})
