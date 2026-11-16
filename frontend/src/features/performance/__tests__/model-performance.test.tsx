// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { ModelPerformance } from '../model-performance'
import { PerformancePage } from '../performance-page'
import { SuccessHistory } from '../success-history'
import { PerformanceHealth } from '@/features/dashboard/performance-health'

vi.mock('../use-performance', () => ({
  useModelPerformance: () => ({
    data: {
      summary: { avg_latency_ms: 100, success_rate: 50, avg_tps: 0, has_tps: false },
      groups: [],
      series: [{ ts: 1, avg_latency_ms: 100, success_rate: 50, avg_tps: 0, has_tps: false, avg_ttft_ms: 0, has_ttft: false }],
    },
  }),
  usePerformanceOverview: () => ({
    data: {
      summary: { avg_latency_ms: 100, success_rate: 50, avg_tps: 0, has_tps: false },
      models: [{ model_name: 'example', avg_latency_ms: 100, success_rate: 50, avg_tps: 0, has_tps: false }],
    },
  }),
}))
afterEach(cleanup)

it('keeps one success sample in the tab order during arrow-key navigation', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <SuccessHistory
        points={[
          { ts: 1, success_rate: 50 },
          { ts: 2, success_rate: 75 },
          { ts: 3, success_rate: 100 },
        ]}
      />
    </I18nextProvider>
  )
  const samples = screen.getAllByRole('img')
  expect(samples.map((sample) => sample.tabIndex)).toEqual([0, -1, -1])

  fireEvent.keyDown(samples[0], { key: 'ArrowRight' })

  expect(document.activeElement).toBe(samples[1])
  expect(samples.map((sample) => sample.tabIndex)).toEqual([-1, 0, -1])
})

it('shows missing throughput and an empty first-token trend when there are no samples', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <ModelPerformance model="example" />
    </I18nextProvider>
  )
  expect(screen.getByText('No measurements yet')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Metric'), { target: { value: 'avg_ttft_ms' } })
  expect(screen.getByText('No performance data in this time range')).toBeTruthy()
})

it('shows missing throughput in the performance table and dashboard overview', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  render(
    <I18nextProvider i18n={i18n}>
      <PerformancePage />
      <PerformanceHealth />
    </I18nextProvider>
  )
  expect(screen.getAllByText('No measurements yet')).toHaveLength(2)
})
