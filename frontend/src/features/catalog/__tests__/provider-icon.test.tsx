// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProviderIcon } from '../model-card'

afterEach(cleanup)

it.each([
  ['eva-seedance-2-0-stable-720p-second', '/orbis/home/bytedance-color.svg'],
  ['seedance-2-5-special-1080p-video', '/orbis/home/bytedance-color.svg'],
  ['eva-wan3-special-720p-second', '/orbis/brand-icons/wan.png'],
  ['wan3p-special-1080p-second', '/orbis/brand-icons/wan.png'],
])('shows the video brand for configured model %s without provider metadata', (modelName, source) => {
  render(<ProviderIcon provider="" modelName={modelName} />)
  expect(screen.getByRole('img', { name: modelName }).getAttribute('src')).toBe(source)
})

it.each(['ByteDance.Color', 'Seedance', 'Doubao.Color', 'Wan'])('uses the existing local brand asset for explicit icon %s', (icon) => {
  render(<ProviderIcon provider="Custom" icon={icon} />)
  expect(screen.getByRole('img').getAttribute('src')).toBe(icon === 'Wan' ? '/orbis/brand-icons/wan.png' : '/orbis/home/bytedance-color.svg')
})

it.each(['/orbis/brand-icons/wan.png', 'https://images.example.com/custom-logo.svg'])(
  'prioritizes a configured image %s over inferred branding',
  (icon) => {
    render(<ProviderIcon provider="OpenAI" modelName="seedance-2-5" icon={icon} size={48} />)
    const image = screen.getByRole('img', { name: 'seedance-2-5' })
    expect(image.getAttribute('src')).toBe(icon)
    expect(image.getAttribute('width')).toBe('48')
    expect(image.getAttribute('height')).toBe('48')
  }
)

it('keeps a fixed size fallback after a failed image and retries when its source changes', () => {
  const { rerender } = render(<ProviderIcon provider="Custom" icon="/missing.png" size={48} />)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.queryByRole('img')).toBeNull()
  const fallback = screen.getByText('C')
  expect(fallback.style.width).toBe('48px')
  expect(fallback.style.height).toBe('48px')
  rerender(<ProviderIcon provider="Custom" icon="/updated.png" size={48} />)
  expect(screen.getByRole('img').getAttribute('src')).toBe('/updated.png')
})

it.each([
  'data:image/svg+xml,<svg/>',
  'javascript:alert(1)',
  'file:///logo.png',
  '//images.example.com/logo.png',
  '/\\images.example.com/logo.png',
  'https://account:secret@images.example.com/logo.png',
  'http://images.example.com/logo.png',
  'https:\n//images.example.com/logo.png',
])('does not load unsafe configured image %s', (icon) => {
  render(<ProviderIcon provider="" icon={icon} />)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('M')).toBeTruthy()
})

it.each([
  ['OpenAI', '/orbis/vendor-icons/openai.svg'],
  ['Anthropic', '/orbis/vendor-icons/anthropic.svg'],
  ['Google', '/orbis/vendor-icons/google.svg'],
  ['DeepSeek', '/orbis/vendor-icons/deepseek.svg'],
  ['Qwen', '/orbis/home/qwen-color.svg'],
])('preserves the existing %s provider icon', (provider, source) => {
  render(<ProviderIcon provider={provider} />)
  expect(screen.getByRole('img', { name: provider }).getAttribute('src')).toBe(source)
})

it.each([
  ['字节跳动', 'bytedance.svg'],
  ['Kuaishou', 'kuaishou.png'],
  ['阿里巴巴', 'alibaba.svg'],
  ['MiniMax', 'minimax.svg'],
  ['xAI', 'xai.svg'],
  ['智谱', 'zhipu.svg'],
  ['Z.AI', 'zhipu.svg'],
  ['ZAI', 'zhipu.svg'],
  ['月之暗面', 'moonshot.svg'],
])('uses the corresponding vendor asset for %s', (provider, filename) => {
  render(<ProviderIcon provider={provider} />)
  expect(screen.getByRole('img', { name: provider }).getAttribute('src')).toBe(`/orbis/vendor-icons/${filename}`)
})

it('attributes the Kuaishou image to its official source for inferred and configured icons', () => {
  const { rerender } = render(<ProviderIcon provider="Kuaishou" />)
  expect(screen.getByRole('img').getAttribute('title')).toContain('kuaishou.com')
  rerender(<ProviderIcon provider="" modelName="kling" icon="/orbis/vendor-icons/kuaishou.png" />)
  expect(screen.getByRole('img').getAttribute('title')).toContain('kuaishou.com')
})

it('keeps known product icons when an explicit named icon is configured', () => {
  render(<ProviderIcon provider="阿里巴巴" icon="Wan" />)
  expect(screen.getByRole('img').getAttribute('src')).toBe('/orbis/brand-icons/wan.png')
})

it('does not use an exact provider match for a different provider name', () => {
  render(<ProviderIcon provider="Kuaishou Partner" />)
  expect(screen.queryByRole('img')).toBeNull()
})

it('preserves the text fallback for unknown brands', () => {
  render(<ProviderIcon provider="Custom" modelName="wanton-example" icon="UnknownIcon" />)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('C')).toBeTruthy()
})
