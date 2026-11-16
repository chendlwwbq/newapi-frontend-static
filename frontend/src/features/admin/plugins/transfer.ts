/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { MarketplacePlugin, MarketplaceSource, MarketplaceVersion, PluginUpload } from './types'

export const MAX_SOURCE_BYTES = 8 * 1024 * 1024
export const MAX_ICON_BYTES = 512 * 1024

export async function marketplaceIconData(index: string, icon: { path: string; sha256?: string }, signal: AbortSignal): Promise<string> {
  const response = await fetch(marketplaceFileUrl(index, icon.path), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  marketplaceFileUrl(index, response.url)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > MAX_ICON_BYTES) throw new Error('Plugin icon exceeds the 512 KiB limit.')
  if (icon.sha256) {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) => value.toString(16).padStart(2, '0')).join('')
    if (hash !== icon.sha256.toLowerCase()) throw new Error('Plugin icon hash does not match the marketplace index.')
  }
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  const mime = /\.png(?:[?#]|$)/i.test(icon.path) ? 'image/png' : 'image/svg+xml'
  return `data:${mime};base64,${btoa(binary)}`
}
export function pluginHttpUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Invalid URL')
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL')
  url.hash = ''
  return url.href
}
export function marketplaceFileUrl(index: string, path: string): string {
  const base = pluginHttpUrl(index),
    url = pluginHttpUrl(new URL(path, base).href)
  if (!path.trim() || new URL(url).origin !== new URL(base).origin) throw new Error('Plugin file must use the marketplace source origin.')
  return url
}
export function validatePluginSource(source: string): string {
  if (!source.trim()) throw new Error('Plugin source is required')
  if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) throw new Error('Plugin source exceeds the 8 MiB limit.')
  return source
}
export function parseMarketplace(payload: unknown): MarketplacePlugin[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid marketplace index')
  const index = payload as Record<string, unknown>
  if (index.indexVersion !== 1 || !Array.isArray(index.plugins)) throw new Error('Invalid marketplace index')
  const result: MarketplacePlugin[] = []
  for (const value of index.plugins) {
    if (!value || typeof value !== 'object' || typeof value.key !== 'string' || !value.key.trim() || !Array.isArray(value.versions)) continue
    const versions: MarketplaceVersion[] = []
    for (const version of value.versions) {
      if (
        !version ||
        typeof version !== 'object' ||
        typeof version.version !== 'string' ||
        !version.version.trim() ||
        typeof version.path !== 'string' ||
        !version.path.trim() ||
        (version.kind && version.kind !== 'task')
      )
        continue
      versions.push({
        version: version.version.trim(),
        path: version.path,
        sha256: typeof version.sha256 === 'string' ? version.sha256.trim() : undefined,
        minApiVersion: typeof version.minApiVersion === 'number' ? version.minApiVersion : undefined,
        allowedHosts: Array.isArray(version.allowedHosts)
          ? version.allowedHosts.filter((host: unknown): host is string => typeof host === 'string')
          : undefined,
        baseUrl: typeof version.baseUrl === 'string' ? version.baseUrl : undefined,
        auth: typeof version.auth === 'string' ? version.auth : undefined,
      })
    }
    if (!versions.length) continue
    let description: MarketplacePlugin['description']
    if (typeof value.description === 'string') description = value.description
    else if (value.description && typeof value.description === 'object' && !Array.isArray(value.description))
      description = Object.fromEntries(Object.entries(value.description).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    result.push({
      key: value.key.trim(),
      name: typeof value.name === 'string' ? value.name : value.key,
      description,
      icon: typeof value.icon === 'string' ? value.icon : undefined,
      iconFile:
        value.iconFile && typeof value.iconFile === 'object' && typeof value.iconFile.path === 'string'
          ? { path: value.iconFile.path, sha256: typeof value.iconFile.sha256 === 'string' ? value.iconFile.sha256 : undefined }
          : undefined,
      models: Array.isArray(value.models) ? value.models.filter((model: unknown): model is string => typeof model === 'string') : undefined,
      latest: versions.some((item) => item.version === value.latest) ? value.latest : versions[0].version,
      versions,
    })
  }
  return result
}
export function validateMarketplaceSources(sources: MarketplaceSource[]): MarketplaceSource[] {
  return sources.map((source) => {
    if (!source.name.trim()) throw new Error('marketplace source name is required')
    return { name: source.name.trim(), index_url: pluginHttpUrl(source.index_url) }
  })
}
export function pluginDryRunRequest(hook: string, text: string) {
  let args: unknown
  try {
    args = JSON.parse(text)
  } catch {
    throw new Error('Arguments must be a JSON array')
  }
  if (!Array.isArray(args)) throw new Error('Arguments must be a JSON array')
  const separator = hook.indexOf('.')
  if (separator < 0) return { hook, args }
  return { hook: hook.slice(0, separator), member: hook.slice(separator + 1), args }
}
export function pluginSourceUrl(value: string): string {
  const url = new URL(pluginHttpUrl(value)),
    parts = url.pathname.split('/').filter(Boolean)
  if (['github.com', 'www.github.com'].includes(url.hostname.toLowerCase()) && ['blob', 'raw'].includes(parts[2]) && parts.length > 4)
    return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts.slice(3).join('/')}`
  if (url.hostname.toLowerCase() === 'gist.github.com' && parts.length)
    return `https://gist.githubusercontent.com/${parts.join('/')}${parts.includes('raw') ? '' : '/raw'}${url.search}`
  return url.href
}
export async function fetchPluginText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(pluginSourceUrl(url), { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache', signal })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) throw new Error('Plugin source exceeds the 8 MiB limit.')
  return validatePluginSource(await response.text())
}

/** Review the exact selected source; cosmetic icon failures do not block installation. */
export async function prepareMarketplaceUpload(
  index: string,
  plugin: MarketplacePlugin,
  version: MarketplaceVersion,
  signal: AbortSignal
): Promise<{ upload: PluginUpload; iconWarning?: string }> {
  if (version.minApiVersion !== undefined && version.minApiVersion > 1) throw new Error('This plugin requires a newer host API version.')
  const [source, icon] = await Promise.allSettled([
    fetchPluginText(marketplaceFileUrl(index, version.path), signal),
    plugin.iconFile ? marketplaceIconData(index, plugin.iconFile, signal) : Promise.resolve(undefined),
  ])
  if (source.status === 'rejected') throw source.reason
  if (signal.aborted) throw signal.reason
  if (version.sha256) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source.value))
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== version.sha256.toLowerCase()) throw new Error('Plugin source hash does not match the marketplace index.')
  }
  return {
    upload: {
      source: source.value,
      icon: icon.status === 'fulfilled' ? icon.value : undefined,
      sourceSha256: version.sha256,
      remark: `${plugin.key}@${version.version} · ${index}`,
      marketplace: { key: plugin.key, version: version.version, index },
    },
    iconWarning: icon.status === 'rejected' ? 'Plugin icon could not be loaded. You can still review and install the source.' : undefined,
  }
}
