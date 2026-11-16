import { describe, expect, it } from 'vitest'
import { clientDestination, resolveClientUrl, ccSwitchUrl } from './client-destination'
import { parseChatConfig } from './chat-links'

describe('client connections', () => {
  it('keeps native preset indices when invalid entries are skipped', () => {
    expect(parseChatConfig('[null,{"Client":"https://client.example/?key={key}"}]')).toMatchObject([{ id: '1', name: 'Client', type: 'web' }])
    expect(parseChatConfig('not json')).toEqual([])
  })
  it('rejects executable, credential-bearing, remote HTTP and key-controlled destinations', () => {
    for (const template of [
      'javascript:alert(1)',
      'data:text/html,hi',
      'file:///etc/passwd',
      'https://user:password@client.example',
      'http://client.example/?key={key}',
      'https://{key}.example/',
    ]) {
      expect(() => clientDestination(template, 'https://eva.example')).toThrow()
    }
  })
  it('preserves the recipient and encodes query credentials', () => {
    const url = new URL(
      resolveClientUrl('https://client.example/?base={address}&key={key}', 'https://eva.example/网关', 'secret&injected=yes#fragment')
    )
    expect(url.origin).toBe('https://client.example')
    expect(url.searchParams.get('base')).toBe('https://eva.example/网关')
    expect(url.searchParams.get('key')).toBe('sk-secret&injected=yes#fragment')
    expect(url.searchParams.has('injected')).toBe(false)
    expect(url.hash).toBe('')
  })
  it('preserves native desktop configuration payloads including Unicode', () => {
    for (const [scheme, placeholder, identity] of [
      ['cherrystudio', 'cherryConfig', 'id'],
      ['aionui', 'aionuiConfig', 'platform'],
      ['deepchat', 'deepchatConfig', 'id'],
    ]) {
      const url = new URL(resolveClientUrl(`${scheme}://provider/add?data={${placeholder}}`, 'https://eva.example/网关', 'example'))
      const payload = JSON.parse(
        new TextDecoder().decode(Uint8Array.from(atob(url.searchParams.get('data')!), (character) => character.charCodeAt(0)))
      )
      expect(payload).toEqual({ [identity]: 'new-api', baseUrl: 'https://eva.example/网关', apiKey: 'sk-example' })
    }
  })
  it('supports AQBot and avoids repeating the API key prefix', () => {
    const url = new URL(resolveClientUrl('aqbot://providers?{aqbotConfig}', 'https://eva.example', 'sk-example'))
    expect(url.searchParams.get('apikey')).toBe('sk-example')
    expect(url.searchParams.get('type')).toBe('openai')
  })
  it('allows loopback development clients and uses the Fluent bridge separately', () => {
    expect(clientDestination('http://127.0.0.1:3041/?key={key}', 'https://eva.example').type).toBe('web')
    expect(clientDestination('fluent', 'https://eva.example').type).toBe('fluent')
    expect(clientDestination('fluentread', 'https://eva.example').type).toBe('fluent')
    expect(() => resolveClientUrl('fluent', 'https://eva.example', 'example')).toThrow('Fluent')
    expect(() => clientDestination('fluent-untrusted:foo', 'https://eva.example')).toThrow()
  })
  it('imports CC Switch applications with their native endpoint and model fields', () => {
    for (const app of ['claude', 'codex', 'gemini']) {
      const url = new URL(ccSwitchUrl('https://eva.example/', app, '我的 eva', { model: 'main', haikuModel: 'small', opusModel: '' }, 'sk-example'))
      expect(url.protocol).toBe('ccswitch:')
      expect(url.searchParams.get('endpoint')).toBe(`https://eva.example${app === 'codex' ? '/v1' : ''}`)
      expect(url.searchParams.get('model')).toBe('main')
      expect(url.searchParams.get('haikuModel')).toBe('small')
      expect(url.searchParams.has('opusModel')).toBe(false)
      expect(url.searchParams.get('apiKey')).toBe('sk-example')
      expect(url.searchParams.get('name')).toBe('我的 eva')
    }
  })
})
