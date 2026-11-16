import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImageAttachment } from '../image-attachment'

it('shows local image thumbnails without exposing encoded image data as text', () => {
  const html = renderToStaticMarkup(<ImageAttachment source="data:image/png;base64,aW1hZ2U=" index={1} />)
  expect(html).toContain('alt="Local image 2"')
  expect(html).toContain('src="data:image/png;base64,aW1hZ2U="')
  expect(html).not.toContain('>data:image/png')
})

it('shows remote image URLs as text without loading them', () => {
  const html = renderToStaticMarkup(<ImageAttachment source="https://example.com/image.png" index={0} />)
  expect(html).toContain('https://example.com/image.png')
  expect(html).not.toContain('<img')
})
