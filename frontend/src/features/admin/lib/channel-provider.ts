import type { ChannelDraft } from './channel-form'
import {
  parseAdvancedCustomConfig,
  validateAdvancedCustomConfig,
  advancedCustomConfigUsesRelativeUpstreamPath,
  hasValidAdvancedCustomModelListRoute,
} from './advanced-custom'

export function channelProviderSettings(value: string | null | undefined): Record<string, unknown> {
  if (!value?.trim()) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('Invalid JSON object')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object')
  return parsed as Record<string, unknown>
}

export function channelProviderSetting(value: string | null | undefined, field: string, next: string | boolean): string {
  const settings = channelProviderSettings(value)
  if (typeof next === 'boolean') settings[field] = next
  else if (next.trim()) settings[field] = next.trim()
  else delete settings[field]
  if (field === 'vertex_key_type' && next !== 'api_key') delete settings.vertex_project_id
  return JSON.stringify(settings)
}

export function channelProviderTypeChange(draft: ChannelDraft, type: number): Partial<ChannelDraft> {
  const settings = channelProviderSettings(draft.settings)
  if (type !== 3) delete settings.azure_responses_version
  if (type !== 33) {
    delete settings.aws_api_type
    delete settings.aws_key_type
  }
  if (type !== 41) {
    delete settings.vertex_key_type
    delete settings.vertex_project_id
  }
  if (type !== 58) delete settings.advanced_custom
  if (type !== 20) delete settings.openrouter_enterprise
  if (type !== 4) delete settings.ollama_openai_chat
  return { type, settings: JSON.stringify(settings) }
}

/** Go stores Vertex regions as a JSON map; accept the original UI's plain region input. */
export function vertexDeploymentRegions(value: string | undefined): string {
  const input = value?.trim() || ''
  if (!input) throw new Error('Deployment region cannot be empty')
  if (!input.startsWith('{')) return JSON.stringify({ default: input })
  const regions = channelProviderSettings(input)
  if (typeof regions.default !== 'string' || !regions.default.trim()) throw new Error('Deployment region must include a default field')
  if (Object.values(regions).some((region) => typeof region !== 'string' || !region.trim())) throw new Error('Invalid deployment region mapping')
  return JSON.stringify(regions)
}

/** Only a replacement is parsed. Existing secrets remain on the native server. */
export function vertexServiceAccounts(contents: string[], batch: boolean): string {
  if (!contents.length || (!batch && contents.length !== 1)) throw new Error('Please upload key file(s)')
  const accounts: unknown[] = contents.map((content) => {
    const account = channelProviderSettings(content)
    if (!Object.keys(account).length) throw new Error('Vertex AI service account key must be valid JSON')
    return account
  })
  return JSON.stringify(batch ? accounts : accounts[0])
}

export function channelProviderRequest(draft: ChannelDraft): Partial<ChannelDraft> {
  if (draft.type === 3 && !draft.other?.trim()) throw new Error('Default API Version is required')
  if ([18, 21, 39, 49].includes(draft.type || 0) && !draft.other?.trim()) throw new Error('This channel type requires additional configuration')
  if (draft.type === 57) {
    if ((!draft.id && draft.mode !== 'single') || draft.channel_info?.is_multi_key) throw new Error('Codex channels do not support batch creation')
    if (draft.key?.trim()) {
      let credential: Record<string, unknown>
      try {
        credential = channelProviderSettings(draft.key)
      } catch {
        throw new Error('Codex credential must be a JSON object with access_token and account_id')
      }
      if (
        typeof credential.access_token !== 'string' ||
        !credential.access_token.trim() ||
        typeof credential.account_id !== 'string' ||
        !credential.account_id.trim()
      )
        throw new Error('Codex credential must be a JSON object with access_token and account_id')
    }
  }
  if (draft.type === 58) {
    const settings = channelProviderSettings(draft.settings)
    const config = parseAdvancedCustomConfig(JSON.stringify(settings.advanced_custom))
    const error = validateAdvancedCustomConfig(config)
    if (error) throw new Error(error.message)
    if (advancedCustomConfigUsesRelativeUpstreamPath(config) && !draft.base_url?.trim())
      throw new Error('Base URL is required when an advanced route uses an upstream path')
    if (settings.upstream_model_update_check_enabled === true && !hasValidAdvancedCustomModelListRoute(config))
      throw new Error('OpenAI Models route is required to enable upstream model checks')
  }
  if (draft.type !== 41) return {}
  const settings = channelProviderSettings(draft.settings)
  if (settings.vertex_key_type === 'api_key' && !draft.id && draft.mode !== 'single')
    throw new Error('Vertex AI API Key mode does not support batch creation')
  const patch: Partial<ChannelDraft> = { other: vertexDeploymentRegions(draft.other) }
  if (draft.key?.trim() && settings.vertex_key_type !== 'api_key') {
    let parsed: unknown
    try {
      parsed = JSON.parse(draft.key)
    } catch {
      throw new Error('Vertex AI service account key must be valid JSON')
    }
    const batch = !draft.id && draft.mode !== 'single'
    if (batch) {
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('Vertex AI service account key must be valid JSON')
      patch.key = vertexServiceAccounts(
        parsed.map((value) => JSON.stringify(value)),
        true
      )
    } else {
      patch.key = vertexServiceAccounts([draft.key], false)
    }
  }
  return patch
}
