import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { ConsoleShell } from './console-shell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/usage-logs/common',
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('@/lib/auth/session', () => ({
  useAuth: () => ({
    phase: 'ready',
    bundle: {
      user: { id: 2, role: 1, username: 'member', group: 'default', quota: 0 },
      session: { sid: 'new-session' },
    },
  }),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}))

function CacheProbe() {
  const client = useQueryClient()
  return <span>{client.getQueryData(['private-log']) || 'empty-session-cache'}</span>
}

describe('console session cache', () => {
  it('does not expose data held by the outer query client', async () => {
    const outer = new QueryClient()
    outer.setQueryData(['private-log'], 'previous-session-record')
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={outer}>
          <ConsoleShell>
            <CacheProbe />
          </ConsoleShell>
        </QueryClientProvider>
      </I18nextProvider>
    )
    expect(html).toContain('empty-session-cache')
    expect(html).not.toContain('previous-session-record')
  })
})
