// @vitest-environment happy-dom
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { CopyButton } from '../copy-button'
import { ErrorState, LoadingState } from '../states'

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }))

afterEach(cleanup)

async function renderI18n(children: ReactNode) {
  const i18n = createInstance()
  await i18n.init({
    lng: 'zh',
    resources: { zh: { translation: { Loading: '加载中', Copy: '复制', Copied: '已复制', 'Copy failed': '复制失败' } } },
  })
  return render(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>)
}

it('uses the localized loading label for assistive technology', async () => {
  await renderI18n(<LoadingState />)
  expect(screen.getByRole('status', { name: '加载中' })).toBeTruthy()
})

it('shows fallback text and keeps retry usable when the error message is blank', async () => {
  const retry = vi.fn()
  await renderI18n(<ErrorState error={new Error(' ')} retry={retry} />)
  expect(screen.getByRole('alert').textContent).toContain('Request failed')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledOnce()
})

it('announces a successful copy without an interruptive alert', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  await renderI18n(<CopyButton value="secret" />)

  fireEvent.click(screen.getByRole('button', { name: '复制' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('已复制'))
  expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(writeText).toHaveBeenCalledWith('secret')
})

it('keeps copy failure feedback in the existing error toast', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('denied'))
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  await renderI18n(<CopyButton value="secret" />)

  fireEvent.click(screen.getByRole('button', { name: '复制' }))
  await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('复制失败'))
})
