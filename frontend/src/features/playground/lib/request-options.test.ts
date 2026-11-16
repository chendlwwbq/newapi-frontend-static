import { expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import { requestParameters, savedPlaygroundSettings } from './request-options'
import { imageUrl, messageContent } from './image-messages'
import { playgroundSelection } from './selection'
import { branchEditedMessage, playgroundMessages } from './conversation'

it('branches an edited user message without changing later messages in the original conversation', () => {
  const original = [
    { id: '1', role: 'user' as const, content: 'old', images: ['https://example.com/a.png'] },
    { id: '2', role: 'assistant' as const, content: 'old answer' },
    { id: '3', role: 'user' as const, content: 'later' },
  ]
  expect(branchEditedMessage(original, '1', 'new')).toEqual([{ id: '1', role: 'user', content: 'new', images: ['https://example.com/a.png'] }])
  expect(original[0].content).toBe('old')
  expect(original).toHaveLength(3)
  expect(branchEditedMessage(original, '2', 'new')).toBeNull()
  expect(branchEditedMessage(original, 'missing', 'new')).toBeNull()
})

it('omits failed and empty assistant replies while keeping stopped partial replies and image questions', () => {
  expect(
    playgroundMessages(
      [
        { role: 'user', content: '', images: ['https://example.com/a.png'] },
        { role: 'assistant', content: '', status: 'stopped' },
        { role: 'assistant', content: 'partial', status: 'stopped' },
        { role: 'assistant', content: 'failed partial', status: 'error' },
      ],
      'Be concise'
    )
  ).toEqual([
    { role: 'system', content: 'Be concise' },
    { role: 'user', content: [{ type: 'image_url', image_url: { url: 'https://example.com/a.png' } }] },
    { role: 'assistant', content: 'partial' },
  ])
})

it('does not replace an explicitly selected model or group when it disappears', () => {
  expect(playgroundSelection(['a', 'b'], '', false)).toBe('a')
  expect(playgroundSelection(['a', 'b'], 'b', true)).toBe('b')
  expect(playgroundSelection(['a'], 'b', true)).toBe('')
  expect(playgroundSelection(['b', 'a'], 'b', true)).toBe('b')
  expect(playgroundSelection([], 'b', true)).toBe('')
})

it('keeps text-only messages unchanged and builds native image parts', () => {
  expect(messageContent('hello')).toBe('hello')
  expect(messageContent('', ['https://example.com/a.png?token=ABC'])).toEqual([
    { type: 'image_url', image_url: { url: 'https://example.com/a.png?token=ABC' } },
  ])
  expect(messageContent('describe', ['https://example.com/a.png'])).toEqual([
    { type: 'text', text: 'describe' },
    { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
  ])
})
it('accepts image web links without rewriting them and rejects unsupported schemes or credentials', () => {
  expect(imageUrl(' https://example.com/a%2Fb.png?sig=A%2FB ')).toBe('https://example.com/a%2Fb.png?sig=A%2FB')
  for (const value of ['file:///a.png', 'javascript:alert(1)', 'https://user:pass@example.com/a.png', 'not a url']) expect(imageUrl(value)).toBeNull()
})

it('sends only explicitly enabled native parameters, preserving false stream and zero penalties', () => {
  expect(requestParameters({ ...DEFAULT_CONFIG, stream: false }, { ...DEFAULT_PARAMETER_ENABLED, temperature: false })).toEqual({
    stream: false,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  })
})
it('keeps optional seed zero and normalizes native parameter boundaries', () => {
  const payload = requestParameters(
    { ...DEFAULT_CONFIG, max_tokens: 999999, seed: 0, frequency_penalty: -20 },
    { ...DEFAULT_PARAMETER_ENABLED, max_tokens: true, seed: true }
  )
  expect(payload).toMatchObject({ max_tokens: 200000, seed: 0, frequency_penalty: -2 })
})
it('preserves saved disabled switches without copying unknown fields into requests', () => {
  const saved = savedPlaygroundSettings(
    JSON.stringify({
      system: 'Be concise',
      config: { stream: false, temperature: 0.3, password: 'ignored' },
      enabled: { temperature: false, seed: true },
    })
  )
  expect(saved.system).toBe('Be concise')
  expect(saved.config).toMatchObject({ stream: false, temperature: 0.3, seed: null })
  expect(saved.enabled.temperature).toBe(false)
  expect(requestParameters(saved.config, saved.enabled)).not.toHaveProperty('password')
  expect(requestParameters(saved.config, saved.enabled)).not.toHaveProperty('seed')
})
it('uses native defaults for missing or malformed device preferences', () => {
  for (const input of [null, '{', 'null']) expect(savedPlaygroundSettings(input).config).toEqual(DEFAULT_CONFIG)
})
