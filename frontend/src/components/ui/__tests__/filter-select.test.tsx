// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { useState } from 'react'
import { FilterSelect } from '../filter-select'

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-theme')
})

it('selects a value with the keyboard without submitting the form and preserves an empty value', async () => {
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  function Fixture() {
    const [value, setValue] = useState('')
    return (
      <form onSubmit={submit}>
        <FilterSelect
          label="Type"
          value={value}
          onChange={setValue}
          options={[
            { value: '', label: 'All' },
            { value: '2', label: 'Consume' },
          ]}
        />
      </form>
    )
  }
  render(
    <I18nextProvider i18n={i18n}>
      <Fixture />
    </I18nextProvider>
  )
  const trigger = screen.getByRole('combobox', { name: 'Type' })
  expect(trigger.textContent).toBe('All')
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'))
  fireEvent.keyDown(trigger, { key: 'End' })
  fireEvent.keyDown(trigger, { key: 'Enter' })
  await waitFor(() => expect(trigger.textContent).toBe('Consume'))
  expect(submit).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(trigger)
  fireEvent.click(trigger)
  fireEvent.click(await screen.findByRole('option', { name: 'All' }))
  await waitFor(() => expect(trigger.textContent).toBe('All'))
  expect(submit).not.toHaveBeenCalled()
})

it('shows a disabled multi-selection summary and updates translated labels without changing the app theme', async () => {
  document.documentElement.dataset.theme = 'dark'
  const onChange = vi.fn()
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const options = [
    { value: '', label: 'All groups' },
    { value: '__multiple__', label: 'Routes · 2', disabled: true },
  ]
  const { rerender } = render(
    <I18nextProvider i18n={i18n}>
      <FilterSelect label="Routes" value="__multiple__" options={options} onChange={onChange} />
    </I18nextProvider>
  )
  const trigger = screen.getByRole('combobox', { name: 'Routes' })
  expect(trigger.textContent).toBe('Routes · 2')
  fireEvent.click(trigger)
  const summary = await screen.findByRole('option', { name: 'Routes · 2' })
  expect(summary.getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(summary)
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.keyDown(trigger, { key: 'Escape' })
  rerender(
    <I18nextProvider i18n={i18n}>
      <FilterSelect label="线路" value="__multiple__" options={[{ value: '__multiple__', label: '线路 · 2', disabled: true }]} onChange={onChange} />
    </I18nextProvider>
  )
  expect(screen.getByRole('combobox', { name: '线路' }).textContent).toBe('线路 · 2')
  expect(document.documentElement.dataset.theme).toBe('dark')
})

it('does not open a disabled filter', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <FilterSelect label="Sort" value="name" options={[{ value: 'name', label: 'Name' }]} onChange={vi.fn()} disabled />
    </I18nextProvider>
  )
  const trigger = screen.getByRole('combobox', { name: 'Sort' })
  expect(trigger.getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(trigger)
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

it('retains a bookmarked value while options load and displays it when available', async () => {
  const onChange = vi.fn()
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const { rerender } = render(
    <I18nextProvider i18n={i18n}>
      <FilterSelect label="Routes" value="vip" options={[{ value: '', label: 'All groups' }]} onChange={onChange} />
    </I18nextProvider>
  )
  expect(screen.getByRole('combobox', { name: 'Routes' }).textContent).toBe('All groups')
  rerender(
    <I18nextProvider i18n={i18n}>
      <FilterSelect
        label="Routes"
        value="vip"
        options={[
          { value: '', label: 'All groups' },
          { value: 'vip', label: 'VIP route' },
        ]}
        onChange={onChange}
      />
    </I18nextProvider>
  )
  expect(screen.getByRole('combobox', { name: 'Routes' }).textContent).toBe('VIP route')
  expect(onChange).not.toHaveBeenCalled()
})
