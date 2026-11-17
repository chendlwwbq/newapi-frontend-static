import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PageTransition } from './page-transition'
import { Reveal } from './reveal'

it('wraps route content in the global page-enter animation class', () => {
  const html = renderToStaticMarkup(
    <PageTransition>
      <main>route content</main>
    </PageTransition>
  )
  expect(html).toContain('class="page-enter"')
  expect(html).toContain('route content')
})

it('renders compact and standard Reveal containers with children intact', () => {
  const html = renderToStaticMarkup(
    <>
      <Reveal compact>compact item</Reveal>
      <Reveal delay={0.1}>standard item</Reveal>
    </>
  )
  expect(html).toContain('compact item')
  expect(html).toContain('standard item')
})
