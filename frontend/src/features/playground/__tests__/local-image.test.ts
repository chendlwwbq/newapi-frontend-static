// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { readLocalImage } from '../lib/local-image'

it('encodes a supported image as a native image_url data URI', async () => {
  const file = new File(['image'], 'photo.png', { type: 'image/png' })
  expect(await readLocalImage(file)).toBe('data:image/png;base64,aW1hZ2U=')
})

it('accepts a photo larger than the previous 512 KB limit', async () => {
  const file = new File([new Uint8Array(512 * 1024 + 1)], 'photo.png', { type: 'image/png' })
  expect(await readLocalImage(file)).toMatch(/^data:image\/png;base64,/)
})

it('rejects unsupported and oversized files before reading them', async () => {
  await expect(readLocalImage(new File(['x'], 'file.svg', { type: 'image/svg+xml' }))).rejects.toThrow()
  await expect(readLocalImage(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))).rejects.toThrow()
  await expect(readLocalImage(new File([new Uint8Array(512 * 1024 + 1)], 'fallback.png', { type: 'image/png' }), 512 * 1024)).rejects.toThrow()
})
