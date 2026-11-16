import { comparePluginSources } from './source-diff'

self.onmessage = (event: MessageEvent<{ before: string; after: string }>) => {
  try {
    self.postMessage({ blocks: comparePluginSources(event.data.before, event.data.after) })
  } catch {
    self.postMessage({ error: true })
  }
}
