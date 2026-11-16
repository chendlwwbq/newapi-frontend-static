// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { RegenerateButton } from '../regenerate-button'

afterEach(cleanup)

it('branches an earlier reply and preserves the original conversation', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const generate = vi.fn(),
    messages = ['question', 'old answer', 'later question', 'later answer']
  render(
    <I18nextProvider i18n={i18n}>
      <RegenerateButton messages={messages} index={1} conversationId="current" onGenerate={generate} />
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate in new conversation' }))
  expect(generate).toHaveBeenCalledWith(['question'], undefined)
  expect(messages).toHaveLength(4)
})

it('regenerates the final reply in the current conversation', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const generate = vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <RegenerateButton messages={['question', 'answer']} index={1} conversationId="current" onGenerate={generate} />
    </I18nextProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
  expect(generate).toHaveBeenCalledWith(['question'], 'current')
})
