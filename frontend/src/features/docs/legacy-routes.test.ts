import { expect, it } from 'vitest'
import config from '../../../next.config'

it('maps legacy bookmarks to existing same-origin pages with query parameters left to Next', async () => {
  const routes = await config.redirects!()
  const target = (source: string) => routes.find((route) => route.source === source)?.destination
  expect(target('/login')).toBe('/sign-in')
  expect(target('/register')).toBe('/sign-up')
  expect(target('/reset')).toBe('/user/reset')
  expect(target('/tokens')).toBe('/keys')
  expect(target('/docs/quickstart')).toBe('/docs/getting-started')
  expect(target('/docs/concepts')).toBe('/docs/models-and-routes')
  expect(target('/docs/choose-route')).toBeUndefined()
  expect(target('/docs/all')).toBeUndefined()
  expect(target('/usage-logs')).toBe('/usage-logs/common')
  expect(target('/system-settings/billing/checkin')).toBe('/system-settings/checkin')
  expect(target('/system-settings/content/drawing')).toBe('/system-settings/drawing')
  expect(target('/system-settings/operations/update-checker')).toBe('/system-updates')
  expect(target('/system-settings/security/ssrf')).toBe('/system-settings/network')
  expect(target('/system-settings/auth/oauth')).toBe('/system-settings/oauth')
  expect(target('/system-settings/models/model-deployment')).toBe('/system-settings/models')
  expect(routes.some((route) => route.source === '/console' || route.source.startsWith('/console/'))).toBe(false)
  expect(routes.every((route) => route.destination.startsWith('/') && !route.destination.startsWith('//'))).toBe(true)
})

it('proxies the admin log collection directly to its canonical backend path', async () => {
  const rewrites = await config.rewrites!()
  expect(Array.isArray(rewrites)).toBe(false)
  if (Array.isArray(rewrites)) throw new Error('Expected phased rewrites')
  const route = rewrites.afterFiles?.find((route) => route.source === '/api/log')
  expect(route?.destination.endsWith('/api/log/')).toBe(true)
})

it('lets dynamic frontend pages resolve before the mode-specific Midjourney fallback', async () => {
  const rewrites = await config.rewrites!()
  expect(Array.isArray(rewrites)).toBe(false)
  if (Array.isArray(rewrites)) throw new Error('Expected phased rewrites')
  expect(rewrites.afterFiles?.some((route) => route.source === '/:mode/mj/:path*')).toBe(false)
  expect(rewrites.fallback?.some((route) => route.source === '/:mode/mj/:path*')).toBe(true)
})
