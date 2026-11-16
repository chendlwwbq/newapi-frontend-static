import type { Catalog, User } from '@/lib/api/types'

// All fixtures are invented. IDs, amounts and metrics are for interface development only.
export type MockRow = { id: number; [key: string]: unknown }
export const modelNames = ['gpt-4.1', 'claude-sonnet-4', 'gemini-2.5-pro', 'deepseek-chat', 'qwen3-235b', 'gpt-image-1', 'flux-1.1-pro', 'eva-seedance-2-0', 'veo-3', 'whisper-1', 'text-embedding-3-small', 'gpt-4.1-mini']
export const providers = ['OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'Qwen', 'OpenAI', 'Black Forest Labs', 'ByteDance', 'Google', 'OpenAI', 'OpenAI', 'OpenAI']
const modalities = ['text', 'text', 'text', 'text', 'text', 'image', 'image', 'video', 'video', 'audio', 'embedding', 'text']
export const mockUser: User = {
  id: 1, username: 'mock-admin', display_name: '演示管理员', email: 'admin@example.invalid', role: 100,
  status: 1, group: 'default', quota: 625000000, used_quota: 12500000, request_count: 8426,
  has_password: false, setting: '{}', permissions: { sidebar_settings: true },
}

export function createCatalog(): Catalog {
  const models = modelNames.map((name, i) => {
    const offerings = ['default', 'premium'].map((group, j) => ({
      offering_key: `${name}:${group}`, name: group, invocation_id: name,
      public_description: j ? '高可用演示线路' : '标准演示线路', availability: 'available',
      prices: [{ currency: 'CNY' as const, status: 'available', group, components: [
        { kind: 'input', amount: String(2 + i + j), quantity: 1000000, unit: 'tokens' },
        { kind: 'output', amount: String(6 + i + j), quantity: 1000000, unit: 'tokens' },
      ] }],
      metrics: [{ metric: 'latency', value: 220 + i * 35, status: 'available' }],
      access: [{ protocols: [modalities[i] === 'image' ? 'openai-image' : modalities[i] === 'video' ? 'openai-video' : 'openai-chat'] }],
    }))
    return {
      model_key: name, configured_model_id: name, name, provider: providers[i], modality: modalities[i],
      description: `${providers[i]} ${name} · 本地示例模型，用于界面和交互重构`, icon: '',
      context_window: 128000, max_output_tokens: 8192, offerings, offerings_count: offerings.length,
      price_summary: offerings.map((offering) => ({ offering_key: offering.offering_key, quote: offering.prices[0] })),
      metrics: [], capabilities: ['streaming'], input_modalities: ['text'], output_modalities: [modalities[i]],
    }
  })
  return { models, total: models.length, currency: 'CNY', schema_version: 1 }
}

export function createMockData() {
  const now = Math.floor(Date.now() / 1000)
  const vendors: MockRow[] = [...new Set(providers)].map((name, i) => ({ id: i + 1, name, status: 1, description: `${name} 演示供应商`, icon: '', model_count: 3 }))
  const models: MockRow[] = modelNames.map((name, i) => ({
    id: i + 1, model_name: name, description: `${name} 的演示说明`, icon: '', tags: modalities[i],
    vendor_id: vendors.find((v) => v.name === providers[i])?.id || 1, endpoints: '{}',
    status: i === 10 ? 0 : 1, sync_official: 0, name_rule: 0, has_metadata: true,
    configured_channel_count: 2, square_state: i === 10 ? 'hidden' : i === 9 ? 'unavailable' : 'visible',
    supported_endpoints: ['openai-chat'], bound_channels: [{ name: '标准演示线路', type: 1 }], enable_groups: ['default', 'premium'],
  }))
  const channels: MockRow[] = Array.from({ length: 26 }, (_, i) => ({
    id: i + 1, name: `${providers[i % providers.length]} 演示渠道 ${i + 1}`, type: 1,
    status: i % 5 === 0 ? 2 : 1, models: modelNames[i % modelNames.length], group: 'default,premium',
    base_url: 'https://upstream.example.invalid', key: '', priority: 10, weight: 1, auto_ban: 1,
    tag: i % 2 ? '文本' : '多模态', remark: '仅用于本地 Mock', balance: 120, used_quota: 2500000,
    created_time: now - 86400, test_time: now - 60, response_time: 250 + i * 20,
    channel_info: { is_multi_key: false, multi_key_mode: 'random', multi_key_size: 1 },
  }))
  const logs: MockRow[] = Array.from({ length: 64 }, (_, i) => ({
    id: i + 1, created_at: now - i * 900, user_id: i % 3 + 1, username: i % 3 ? 'demo-user' : 'mock-admin',
    type: i % 9 === 0 ? 5 : 2, model_name: modelNames[i % modelNames.length], token_name: i % 2 ? '开发测试' : '演示应用',
    token_id: i % 2 + 1, quota: 1500 + i * 125, prompt_tokens: 250 + i * 12, completion_tokens: 140 + i * 7,
    use_time: i % 7 + 1, content: i % 9 === 0 ? 'Mock upstream unavailable' : '', group: i % 4 ? 'default' : 'premium',
    channel: i % channels.length + 1, channel_name: channels[i % channels.length].name, is_stream: true,
    ip: '127.0.0.1', request_id: `mock-request-${i + 1}`, other: JSON.stringify({ first_response_time: 240, model_ratio: 1, completion_ratio: 2 }),
  }))
  const tasks: MockRow[] = Array.from({ length: 28 }, (_, i) => ({
    id: i + 1, user_id: 1, username: 'mock-admin', platform: 'mock', task_id: `mock-task-${i + 1}`,
    channel_id: 2, group: 'default', quota: 250000, action: 'GENERATE', created_at: now - i * 1800,
    submit_time: now - i * 1800, start_time: now - i * 1800 + 5, finish_time: now - i * 1800 + 45,
    status: i % 6 === 0 ? 'FAILURE' : 'SUCCESS', progress: '100%',
    fail_reason: i % 6 === 0 ? '模拟失败：用于检查错误展示' : '',
    properties: { origin_model_name: 'eva-seedance-2-0', input: '海边日落与慢镜头海浪' },
    admin_info: { request_id: `mock-video-${i + 1}`, request_path: '/v1/videos' },
  }))
  const drawings: MockRow[] = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1, user_id: 1, channel_id: 2, mj_id: `mock-drawing-${i + 1}`, action: 'IMAGINE', status: 'SUCCESS',
    progress: '100%', quota: 100000, submit_time: (now - i * 3600) * 1000, start_time: (now - i * 3600 + 1) * 1000,
    finish_time: (now - i * 3600 + 20) * 1000, prompt: '本地示例图像', prompt_en: 'Local mock illustration', description: '',
    fail_reason: '', image_url: '/mock/sample.svg', video_url: '', video_urls: '[]',
  }))
  const audits: MockRow[] = Array.from({ length: 24 }, (_, i) => ({
    id: i + 1, event_id: `mock-event-${i + 1}`, actor_role: 100, method: 'POST', route: '/api/channel', status: 200, token_ref: 'mock-key', content: '本地模拟审计事件', other: {}, user_id: 1, username: 'mock-admin', created_at: now - i * 600, category: i % 2 ? 'management' : 'security',
    action: i % 2 ? 'channel.update' : 'login', success: i % 5 !== 0, ip: '127.0.0.1', user_agent: 'Mock browser',
    request_id: `mock-audit-${i + 1}`, message: '本地模拟事件', details: {},
  }))
  const tokens: MockRow[] = ['演示应用', '开发测试', '移动端'].map((name, i) => ({
    id: i + 1, name, status: i === 2 ? 2 : 1, key: `mock-not-a-real-api-key-${i + 1}`, group: 'default',
    created_time: now - 86400, accessed_time: now - 60, expired_time: -1, remain_quota: 25000000,
    used_quota: 2500000, unlimited_quota: false, model_limits_enabled: false, model_limits: '', allow_ips: '', cross_group_retry: false,
  }))
  const users: MockRow[] = Array.from({ length: 22 }, (_, i) => ({ ...mockUser, id: i + 1,
    username: i ? `demo-user-${i}` : 'mock-admin', display_name: i ? `演示用户 ${i}` : '演示管理员',
    email: `demo${i}@example.invalid`, role: i ? 1 : 100, status: i === 5 ? 2 : 1,
  }))
  const usage: MockRow[] = Array.from({ length: 28 }, (_, i) => ({
    id: i + 1, created_at: now - i * 21600, model_name: modelNames[i % 5], use_group: 'default', group: 'default',
    username: 'mock-admin', user_id: 1, token_used: 12000 + (i % 7) * 1500, count: 80 + i * 3,
    quota: 250000 + (i % 5) * 50000, cache_read_tokens: 1000, cache_creation_tokens: 200,
  }))
  const options: MockRow[] = Object.entries({
    SystemName: 'eva · Mock', ServerAddress: 'http://127.0.0.1:3031', QuotaPerUnit: '500000',
    DisplayInCurrencyEnabled: 'true', GroupRatio: '{"default":1,"premium":1.5}',
    UserUsableGroups: '{"default":"标准分组","premium":"高级分组"}', VideoStorageEnabled: 'true',
  }).map(([key, value], i) => ({ id: i + 1, key, value }))
  return { models, channels, vendors, logs, tasks, drawings, audits, tokens, users, usage, options,
    groups: [{ id: 1, name: '常用模型', group: 'default', models: modelNames.join(',') }] as MockRow[],
    redemptions: [{ id: 1, name: '体验额度', key: 'mock-redemption-only', status: 1, quota: 5000000, created_time: now, redeemed_time: 0, expired_time: 0 }] as MockRow[],
    notices: [] as MockRow[],
  }
}
