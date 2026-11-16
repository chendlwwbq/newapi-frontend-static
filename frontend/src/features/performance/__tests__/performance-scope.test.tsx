// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePerformanceOverview } from '../use-performance'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { PerformancePage } from '../performance-page'

const request = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth/session', () => ({
  useAuth: () => ({ phase: 'ready', bundle: { user: { id: 1, group: 'default' }, session: { sid: 'session' } } }),
}))
vi.mock('@/lib/api/client', () => ({ api: request }))
afterEach(() => {
  cleanup()
  request.mockReset()
})

it('requests statistics for the selected groups when they change', async () => {
  request.mockResolvedValue({ models: [] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { rerender } = renderHook(({ groups }) => usePerformanceOverview(24, groups), { initialProps: { groups: ['a'] }, wrapper })
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  expect(request.mock.calls[0][0]).toBe('/api/perf-metrics/summary?hours=24&group=a')
  rerender({ groups: ['b', 'a'] })
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  expect(request.mock.calls[1][0]).toBe('/api/perf-metrics/summary?hours=24&group=a&group=b')
  rerender({ groups: [] })
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
  expect(request.mock.calls[2][0]).toBe('/api/perf-metrics/summary?hours=24')
})

it('changing the time range refreshes performance data immediately and retains the search text', async () => {
  request.mockResolvedValue({
    models: ['alpha-model', 'beta-model'].map((model_name) => ({ model_name, avg_latency_ms: 100, success_rate: 95, avg_tps: 10 })),
  })
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <PerformancePage />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByText('beta-model')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'alpha' } })
  fireEvent.click(screen.getByRole('combobox', { name: 'Time range' }))
  fireEvent.click(await screen.findByRole('option', { name: '72 hours' }))
  await waitFor(() => expect(String(request.mock.lastCall?.[0])).toBe('/api/perf-metrics/summary?hours=72'))
  expect(await screen.findByText('alpha-model')).toBeTruthy()
  expect(screen.queryByText('beta-model')).toBeNull()
  expect((screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement).value).toBe('alpha')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await waitFor(() => expect(request.mock.calls.filter(([url]) => url === '/api/perf-metrics/summary?hours=72')).toHaveLength(2))
})
