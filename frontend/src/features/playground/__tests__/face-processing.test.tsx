// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { FaceProcessingPanel, FaceProcessingTool } from '../face-processing'

const config = vi.hoisted(() => ({ enabled: true, max_bytes: 10 * 1024 * 1024 }))
vi.mock('@/lib/api/client', () => ({ api: async () => ({ ...config }) }))
vi.mock('@/lib/auth/session', () => ({ freshAuthHeaders: async () => ({ 'New-Api-User': '1' }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  config.enabled = true
})

async function openPanel(tool = false) {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>{tool ? <FaceProcessingTool /> : <FaceProcessingPanel />}</QueryClientProvider>
    </I18nextProvider>
  )
}

it('processes only after an explicit click and exposes the JPEG preview and download', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(new Blob(['jpeg'], { type: 'image/jpeg' }), {
      headers: { 'Content-Type': 'image/jpeg', 'X-Face-Stats': '{"action":"processed"}' },
    })
  )
  vi.stubGlobal('fetch', fetcher)
  await openPanel()
  const input = await screen.findByLabelText('Reference image')
  const file = new File(['png'], 'photo.png', { type: 'image/png' })
  expect((screen.getByRole('button', { name: 'Process image' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(input, { target: { files: [file] } })
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Process image' }))
  expect(await screen.findByAltText('Processed image')).toBeTruthy()
  const [url, request] = fetcher.mock.calls[0]
  expect(url).toBe('/api/playground/uploads/face-processing?method=grid')
  expect(request.body).toBe(file)
  expect(request.headers['New-Api-User']).toBe('1')
  expect(screen.getByRole('link', { name: 'Download processed image' }).getAttribute('download')).toBe('face-grid.jpg')
  fireEvent.change(input, { target: { files: [new File(['new'], 'next.png', { type: 'image/png' })] } })
  expect(screen.queryByRole('link', { name: 'Download processed image' })).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-preview')
})

it('rejects unsupported and oversized files without sending a request', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  await openPanel()
  const input = await screen.findByLabelText('Reference image')
  fireEvent.change(input, { target: { files: [new File(['gif'], 'photo.gif', { type: 'image/gif' })] } })
  expect(screen.getByRole('alert').textContent).toContain('Select a valid JPEG, PNG or WebP image')
  fireEvent.change(input, { target: { files: [new File([new Uint8Array(config.max_bytes + 1)], 'large.png', { type: 'image/png' })] } })
  expect(screen.getByRole('alert').textContent).toContain('Face image must be at most 10 MB')
  expect((screen.getByRole('button', { name: 'Process image' }) as HTMLButtonElement).disabled).toBe(true)
  expect(fetcher).not.toHaveBeenCalled()
})

it('shows a service failure without a downloadable result and allows retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"Face processing is unavailable"}', { status: 503 })))
  await openPanel()
  fireEvent.change(await screen.findByLabelText('Reference image'), { target: { files: [new File(['png'], 'photo.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Process image' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Face processing is unavailable')
  expect(screen.queryByRole('link')).toBeNull()
  expect((screen.getByRole('button', { name: 'Process image' }) as HTMLButtonElement).disabled).toBe(false)
})

it('disables input while processing and aborts the pending request when closed', async () => {
  const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const panel = await openPanel()
  const input = await screen.findByLabelText('Reference image')
  fireEvent.change(input, { target: { files: [new File(['png'], 'photo.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Process image' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  expect((input as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Processing image…' }) as HTMLButtonElement).disabled).toBe(true)
  panel.unmount()
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
})

it('explains that the service is unavailable when not configured', async () => {
  config.enabled = false
  await openPanel()
  expect(await screen.findByText('Face processing is unavailable')).toBeTruthy()
  expect(screen.queryByLabelText('Reference image')).toBeNull()
})

it('opens the named dialog and restores trigger focus after Escape', async () => {
  await openPanel(true)
  const trigger = screen.getByRole('button', { name: 'Face processing' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Face processing' })
  await screen.findByLabelText('Reference image')
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(trigger))
})
