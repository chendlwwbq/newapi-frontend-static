// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { MessageMarkdown } from '../message-markdown'

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

it('renders markdown, code and tables without executing HTML or loading remote images', () => {
  const source =
    '**hello**\n\n```js\nconst x = 1\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n![private](https://example.com/track)\n\n[bad](javascript:alert(1))'
  const html = renderToStaticMarkup(<MessageMarkdown content={source} />)
  expect(html).toContain('<strong>hello</strong>')
  expect(html).toContain('<pre>')
  expect(html).toContain('<table>')
  expect(html).not.toContain('<script')
  expect(html).not.toContain('<img')
  expect(html).toContain('Show Image')
  expect(html).not.toContain('javascript:')
})

it('does not offer to load an image with an unsupported or credential-bearing URL', () => {
  for (const url of ['javascript:alert(1)', 'https://user:pass@example.com/image.png']) {
    const html = renderToStaticMarkup(<MessageMarkdown content={`![private](${url})`} />)
    expect(html).not.toContain('Show Image')
    expect(html).not.toContain('<img')
  }
})

it('renders inline and display math while keeping code fences literal', () => {
  const html = renderToStaticMarkup(<MessageMarkdown content={'Inline $x^2$\n\n$$\ny = x + 1\n$$\n\n```\n$x^2$\n```'} />)
  expect(html).toContain('class="katex"')
  expect(html).toContain('class="katex-display"')
  expect(html).toContain('$x^2$')
})

it('does not allow untrusted formula links to introduce executable URLs', () => {
  const html = renderToStaticMarkup(<MessageMarkdown content={'$\\href{javascript:alert(1)}{click}$'} />)
  expect(html).not.toContain('href="javascript:')
})

it('offers a copy action and language label for each fenced code block', () => {
  const html = renderToStaticMarkup(<MessageMarkdown content={'```js\nfirst()\n```\n\n```python\nsecond()\n```'} />)
  expect(html.match(/aria-label="Copy code"/g)).toHaveLength(2)
  expect(html).toContain('>js<')
  expect(html).toContain('>python<')
  expect(html).toContain('first()')
  expect(html).toContain('second()')
})

it('copies the selected code block and loads an image only after it is requested', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <MessageMarkdown content={'```js\nfirst()\n```\n\n```python\nsecond()\n```\n\n![Example](https://example.com/image.png)'} />
    </I18nextProvider>
  )
  expect(screen.queryByRole('img', { name: 'Example' })).toBeNull()
  fireEvent.click(screen.getAllByRole('button', { name: 'Copy code' })[1])
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('second()\n'))
  fireEvent.click(screen.getByRole('button', { name: 'Show Image · Example' }))
  expect(screen.getByRole('img', { name: 'Example' }).getAttribute('src')).toBe('https://example.com/image.png')
  fireEvent.click(screen.getByRole('button', { name: 'Hide Image · Example' }))
  expect(screen.queryByRole('img', { name: 'Example' })).toBeNull()
})
