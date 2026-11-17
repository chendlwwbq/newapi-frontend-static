// @vitest-environment happy-dom
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { CopyButton } from '../copy-button'
import { JsonValueInput } from '../json-value-input'
import { ErrorState, LoadingState } from '../states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

  const button = screen.getByRole('button', { name: '复制' })
  fireEvent.click(button)
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('已复制'))
  expect(button.className).toContain('border-emerald-500/60')
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

it('applies disabled, aria-busy, and a spinner when Button loading is true', async () => {
  await renderI18n(<Button loading>Save</Button>)
  const button = screen.getByRole('button', { name: 'Save' })
  expect(button).toHaveProperty('disabled', true)
  expect(button.getAttribute('aria-busy')).toBe('true')
  expect(button.querySelector('svg.animate-spin')).not.toBeNull()
})

it('keeps password visibility keyboard reachable and preserves the entered password', async () => {
  await renderI18n(<Input aria-label="Secret" type="password" defaultValue="s3cr3t" />)
  const input = screen.getByLabelText('Secret')
  const toggle = screen.getByRole('button', { name: 'Show password' })
  expect(input.getAttribute('type')).toBe('password')
  expect(toggle.tabIndex).toBe(0)
  fireEvent.click(toggle)
  expect(input.getAttribute('type')).toBe('text')
  expect(input).toHaveProperty('value', 's3cr3t')
  expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy()
})

it('disables password visibility when the password input is disabled', async () => {
  await renderI18n(<Input aria-label="Secret" type="password" defaultValue="s3cr3t" disabled />)
  const toggle = screen.getByRole('button', { name: 'Show password' })
  expect(toggle).toHaveProperty('disabled', true)
  fireEvent.click(toggle)
  expect(screen.getByLabelText('Secret').getAttribute('type')).toBe('password')
})

it('retains the accessible name of an icon button while loading', async () => {
  await renderI18n(
    <Button size="icon" loading>
      <span className="sr-only">Save changes</span>
    </Button>
  )
  expect(screen.getByRole('button', { name: 'Save changes' }).getAttribute('aria-busy')).toBe('true')
})

it('formats valid JSON via the Format JSON button in JsonValueInput', async () => {
  const onChange = vi.fn()
  await renderI18n(<JsonValueInput label="Overrides" value={{ b: 1 }} onChange={onChange} objectOnly />)
  const textarea = screen.getByRole('textbox', { name: 'Overrides' }) as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: '{"a":1,"nested":{"x":true}}' } })
  fireEvent.click(screen.getByRole('button', { name: 'Format JSON' }))
  expect(textarea.value).toBe('{\n  "a": 1,\n  "nested": {\n    "x": true\n  }\n}')
  expect(onChange).toHaveBeenLastCalledWith({ a: 1, nested: { x: true } })
})
