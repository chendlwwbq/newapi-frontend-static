// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import NotFound from '../not-found'
import ErrorPage from '../error'
import { ContentPage } from '@/features/docs/content-page'

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

it('renders error digest copy capsule and dual exits in ErrorPage', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const reset = vi.fn()
  const err = Object.assign(new Error('Upstream timeout'), { digest: 'err-digest-42' })
  render(
    <I18nextProvider i18n={i18n}>
      <ErrorPage error={err} reset={reset} />
    </I18nextProvider>
  )
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
  expect(screen.getByText(/digest=err-digest-42 · Upstream timeout/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Models' }).getAttribute('href')).toBe('/pricing')
  expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('href')).toBe('/dashboard/overview')
  expect(screen.getByRole('link', { name: 'Return home' }).getAttribute('href')).toBe('/')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(reset).toHaveBeenCalledOnce()
})

it('renders unified max-w-4xl header and guided fallback in ContentPage when empty', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const { container } = render(
    <I18nextProvider i18n={i18n}>
      <ContentPage title="Privacy policy" content="" fallbackDescription="Custom placeholder note." />
    </I18nextProvider>
  )
  expect(container.querySelector('article.docs-article')?.className).toContain('max-w-4xl')
  expect(screen.getByText('Custom placeholder note.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Return home' }).getAttribute('href')).toBe('/')
  expect(screen.getByRole('link', { name: 'Models' }).getAttribute('href')).toBe('/pricing')
  expect(screen.getByRole('link', { name: 'Help center' }).getAttribute('href')).toBe('/docs')
})
