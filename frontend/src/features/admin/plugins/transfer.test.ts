import { resolvePluginIcon, pluginIconUrl } from './icon-contract'
import { marketplaceIconData, prepareMarketplaceUpload } from './transfer'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchPluginText,
  marketplaceFileUrl,
  MAX_SOURCE_BYTES,
  parseMarketplace,
  pluginDryRunRequest,
  pluginHttpUrl,
  pluginSourceUrl,
  validateMarketplaceSources,
  validatePluginSource,
} from './transfer'
import { comparePluginSources } from './source-diff'
import { changedMetadataFields } from './metadata-diff'

describe('plugin import contracts', () => {
  it.each(['javascript:alert(1)', 'file:///tmp/plugin.js', 'https://user:password@example.test/plugin.js'])(
    'rejects unsafe source URL %s',
    (value) => {
      expect(() => pluginHttpUrl(value)).toThrow()
    }
  )
  it('converts code-host source pages to raw content', () => {
    expect(pluginSourceUrl('https://github.com/org/repo/blob/main/plugin.js?plain=1#L20')).toBe(
      'https://raw.githubusercontent.com/org/repo/main/plugin.js'
    )
    expect(pluginSourceUrl('https://gist.github.com/user/id')).toBe('https://gist.githubusercontent.com/user/id/raw')
  })
  it('resolves marketplace files on the declared origin only', () => {
    expect(marketplaceFileUrl('https://example.test/repo/index.json', './plugins/a.js')).toBe('https://example.test/repo/plugins/a.js')
    expect(() => marketplaceFileUrl('https://example.test/index.json', 'https://other.test/a.js')).toThrow()
    expect(() => marketplaceFileUrl('https://example.test/index.json', '//other.test/a.js')).toThrow()
  })
  it('enforces byte limits for non-ASCII source', () => {
    expect(() => validatePluginSource('界'.repeat(Math.ceil(MAX_SOURCE_BYTES / 3)))).toThrow()
    expect(() => validatePluginSource('  ')).toThrow()
    expect(validatePluginSource('export const value = 1;')).toContain('export')
  })
  it('preserves declared versions and excludes unsupported plugin kinds', () => {
    const plugins = parseMarketplace({
      indexVersion: 1,
      plugins: [
        {
          key: 'task',
          name: 'Task',
          latest: '2',
          models: ['model', 1],
          versions: [
            { version: '1', path: '1.js', kind: 'task' },
            { version: '2', path: '2.js', sha256: 'abc' },
            { version: '3', path: '3.js', kind: 'other' },
          ],
        },
        { key: 'invalid', versions: [] },
      ],
    })
    expect(plugins).toHaveLength(1)
    expect(plugins[0].latest).toBe('2')
    expect(plugins[0].models).toEqual(['model'])
    expect(plugins[0].versions.map((version) => version.version)).toEqual(['1', '2'])
  })
  it('rejects unsupported marketplace index formats', () => {
    expect(() => parseMarketplace({ indexVersion: 2, plugins: [] })).toThrow()
    expect(() => parseMarketplace([])).toThrow()
  })
  it('maps a member hook to the native dry-run request', () => {
    expect(pluginDryRunRequest('native.decodeSubmit', '[{"x":1}]')).toEqual({ hook: 'native', member: 'decodeSubmit', args: [{ x: 1 }] })
    expect(pluginDryRunRequest('buildSubmitRequest', '[{}]')).toEqual({ hook: 'buildSubmitRequest', args: [{}] })
    expect(() => pluginDryRunRequest('buildSubmitRequest', '{}')).toThrow('Arguments must be a JSON array')
    expect(() => pluginDryRunRequest('buildSubmitRequest', '[')).toThrow('Arguments must be a JSON array')
  })
  it('normalizes sources and allows clearing the marketplace list', () => {
    expect(validateMarketplaceSources([{ name: ' Local ', index_url: 'https://example.test/index.json#fragment' }])).toEqual([
      { name: 'Local', index_url: 'https://example.test/index.json' },
    ])
    expect(validateMarketplaceSources([])).toEqual([])
    expect(() => validateMarketplaceSources([{ name: '', index_url: 'https://example.test' }])).toThrow()
  })
  it('fetches remote source without gateway credentials', async () => {
    const original = globalThis.fetch,
      controller = new AbortController()
    const calls: RequestInit[] = []
    globalThis.fetch = async (_input, init) => {
      calls.push(init!)
      return new Response('export const value = 1;')
    }
    try {
      expect(await fetchPluginText('https://example.test/source.js', controller.signal)).toContain('export')
      expect(calls[0]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal })
      expect(calls[0].headers).toBeUndefined()
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('plugin version review', () => {
  it.each([
    ['a\nb\nc\n', 'a\nnew\nc\n'],
    ['', 'a\n'],
    ['a\n', ''],
    ['same\n', 'same\n'],
    ['a\r\nb\r\n', 'a\nb\n'],
    ['a\n', 'a'],
    ['a\na\nb\na\n', 'a\nb\na\nnew\n'],
  ])('reconstructs both complete sources from the diff', (before, after) => {
    const blocks = comparePluginSources(before, after)
    expect(
      blocks
        .filter((block) => block.kind !== 'added')
        .flatMap((block) => block.lines)
        .join('')
    ).toBe(before)
    expect(
      blocks
        .filter((block) => block.kind !== 'removed')
        .flatMap((block) => block.lines)
        .join('')
    ).toBe(after)
  })
  it('tracks old and new line numbers across additions and removals', () => {
    expect(
      comparePluginSources('a\nb\nc\n', 'a\nx\ny\nc\n').map(({ kind, beforeLine, afterLine, lines }) => [kind, beforeLine, afterLine, lines.length])
    ).toEqual([
      ['same', 1, 1, 1],
      ['removed', 2, 2, 1],
      ['added', 3, 2, 2],
      ['same', 3, 4, 1],
    ])
  })
  it('ignores object key order but detects array order, removed fields and false/zero changes', () => {
    expect(
      changedMetadataFields(
        { auth: { a: 1, b: 2 }, models: ['a', 'b'], enabled: false, limit: 0, removed: true },
        { auth: { b: 2, a: 1 }, models: ['b', 'a'], enabled: true, limit: 1 }
      )
    ).toEqual(['enabled', 'limit', 'models', 'removed'])
  })
})

describe('plugin image and manifest contracts', () => {
  it('preserves Unicode text labels and never infers an icon from channel types', () => {
    expect(resolvePluginIcon({ key: 'custom', name: '中文插件', channelTypes: [1] })).toEqual({ kind: 'text', label: '中文', colorSeed: 'custom' })
    expect(resolvePluginIcon({ key: 'custom', icon: 'text:EVA' })).toEqual({ kind: 'text', label: 'EVA', colorSeed: 'custom' })
    expect(resolvePluginIcon({ key: 'custom', icon: 'Sora.Color' })).toEqual({ kind: 'lobe', name: 'Sora.Color' })
  })
  it('rejects URLs in manifest icons and uses the authenticated sidecar URL only when explicitly requested', () => {
    expect(resolvePluginIcon({ key: 'a', icon: 'data:image/svg+xml,evil' }).kind).toBe('text')
    expect(resolvePluginIcon({ key: 'a', icon: 'https://other.test/icon.svg' }).kind).toBe('text')
    expect(pluginIconUrl('a/b', '1.0.0+build')).toBe('/api/plugin/task/a%2Fb/icon?version=1.0.0%2Bbuild')
    expect(resolvePluginIcon({ key: 'a', hasIcon: true, icon: 'text:A', iconSrc: 'blob:local' })).toEqual({ kind: 'image', src: 'blob:local' })
  })
  it('retains marketplace icon metadata without replacing the manifest descriptor', () => {
    const [plugin] = parseMarketplace({
      indexVersion: 1,
      plugins: [
        { key: 'a', name: 'A', icon: 'Sora.Color', iconFile: { path: 'a.svg', sha256: 'abc' }, versions: [{ version: '1.0.0', path: 'a.js' }] },
      ],
    })
    expect(plugin.icon).toBe('Sora.Color')
    expect(plugin.iconFile).toEqual({ path: 'a.svg', sha256: 'abc' })
  })
  it('fetches marketplace logos without credentials and verifies their actual bytes', async () => {
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) => value.toString(16).padStart(2, '0')).join('')
    const response = new Response(bytes)
    Object.defineProperty(response, 'url', { value: 'https://example.test/icons/a.svg' })
    const fetcher = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetcher)
    try {
      expect(await marketplaceIconData('https://example.test/index.json', { path: 'icons/a.svg', sha256 }, new AbortController().signal)).toContain(
        'data:image/svg+xml;base64,'
      )
      expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' })
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('refuses a cross-origin icon before fetching it', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    try {
      await expect(
        marketplaceIconData('https://example.test/index.json', { path: 'https://other.test/a.svg' }, new AbortController().signal)
      ).rejects.toThrow('origin')
      expect(fetcher).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('marketplace installation review', () => {
  const plugin = {
    key: 'review',
    name: 'Review',
    latest: '1.0.0',
    versions: [{ version: '1.0.0', path: 'review.js' }],
    iconFile: { path: 'icon.svg' },
  }
  it('continues to source review when a cosmetic icon cannot load', async () => {
    const source = 'export const meta = {};'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('.svg')) throw new Error('missing icon')
        return new Response(source)
      })
    )
    try {
      const result = await prepareMarketplaceUpload('https://market.test/index.json', plugin, plugin.versions[0], new AbortController().signal)
      expect(result.upload.source).toBe(source)
      expect(result.upload.marketplace).toEqual({ key: 'review', version: '1.0.0', index: 'https://market.test/index.json' })
      expect(result.iconWarning).toBeTruthy()
      expect(result.upload.icon).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('rejects mismatched source bytes before opening a verified review', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('changed source'))
    )
    try {
      await expect(
        prepareMarketplaceUpload(
          'https://market.test/index.json',
          { ...plugin, iconFile: undefined },
          { ...plugin.versions[0], sha256: '0'.repeat(64) },
          new AbortController().signal
        )
      ).rejects.toThrow('source hash')
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('rejects a future API version before fetching files', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    try {
      await expect(
        prepareMarketplaceUpload('https://market.test/index.json', plugin, { ...plugin.versions[0], minApiVersion: 2 }, new AbortController().signal)
      ).rejects.toThrow('newer host')
      expect(fetcher).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
