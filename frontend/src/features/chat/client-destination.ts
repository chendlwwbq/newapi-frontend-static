import { resolveChatUrl } from './chat-links'

const desktopProtocols = new Set(['cherrystudio:', 'aionui:', 'deepchat:', 'aqbot:', 'chatbox:', 'ama:', 'opencat:', 'ccswitch:'])
const previewKey = 'eva-destination-preview'
export function clientDestination(template: string, serverAddress: string) {
  if (['fluent', 'fluent://', 'fluentread'].includes(template)) return { target: 'Fluent', type: 'fluent' as const, origin: 'fluent:' }
  if (template === 'ccswitch') return { target: 'CC Switch', type: 'desktop' as const, origin: 'ccswitch://v1' }
  const url = new URL(resolveChatUrl({ template, serverAddress, apiKey: previewKey }))
  const web = url.protocol === 'https:' || url.protocol === 'http:'
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  // Credentials cannot determine their own recipient or travel to remote HTTP.
  if (
    (!web && !desktopProtocols.has(url.protocol)) ||
    url.username ||
    url.password ||
    url.host.includes(previewKey) ||
    (url.protocol === 'http:' && !local)
  )
    throw new Error('Unsupported client destination')
  return {
    target: web ? url.origin : `${url.protocol}//${url.host}`,
    type: web ? ('web' as const) : ('desktop' as const),
    origin: `${url.protocol}//${url.host}`,
  }
}
export function ccSwitchUrl(address: string, app: string, name: string, models: Record<string, string>, key: string) {
  const base = address.replace(/\/$/, '')
  const params = new URLSearchParams({
    resource: 'provider',
    app,
    name,
    endpoint: app === 'codex' ? `${base}/v1` : base,
    apiKey: key.startsWith('sk-') ? key : `sk-${key}`,
    homepage: base,
    enabled: 'true',
  })
  for (const [field, value] of Object.entries(models)) if (value) params.set(field, value)
  return `ccswitch://v1/import?${params}`
}
export function resolveClientUrl(template: string, serverAddress: string, apiKey: string) {
  const destination = clientDestination(template, serverAddress)
  if (destination.type === 'fluent') throw new Error('Use the Fluent integration')
  const url = new URL(resolveChatUrl({ template, serverAddress, apiKey }))
  if (`${url.protocol}//${url.host}` !== destination.origin || url.username || url.password) throw new Error('Unsupported client destination')
  return url.href
}
