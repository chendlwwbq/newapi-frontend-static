import { beforeEach, expect, it, vi } from 'vitest'
import DocsRoute from '@/app/(public)/docs/[[...slug]]/page'
import { publicOptionalApi } from '@/lib/api/server'

vi.mock('@/lib/api/server', () => ({ publicOptionalApi: vi.fn() }))

beforeEach(() => vi.mocked(publicOptionalApi).mockReset())

it('sends the video guide entry to the published full guide', async () => {
  vi.mocked(publicOptionalApi).mockResolvedValue({})
  await expect(DocsRoute({ params: Promise.resolve({ slug: ['video-generation'] }) })).rejects.toMatchObject({
    digest: expect.stringContaining('/docs/published/video-generation-api'),
  })
})

it('falls back to the built-in guide when no full guide is published', async () => {
  vi.mocked(publicOptionalApi).mockResolvedValue(null)
  const page = await DocsRoute({ params: Promise.resolve({ slug: ['video-generation'] }) })
  expect(page.props.slug).toBe('video-generation')
})
