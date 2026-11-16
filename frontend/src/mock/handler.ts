import { createCatalog, createMockData, mockUser, modelNames, type MockRow } from './data'

type Store = { data: ReturnType<typeof createMockData>; unhandled: string[] }
const shared = globalThis as typeof globalThis & { __newApiMock?: Store }
const store = (shared.__newApiMock ??= { data: createMockData(), unhandled: [] })

export function resetMockData() {
  store.data = createMockData()
  store.unhandled = []
}

function reply(data: unknown, status = 200, message?: string) {
  return Response.json({ success: status < 400, data, ...(message ? { message } : {}) }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Mock-Response': 'true' },
  })
}

function page(rows: MockRow[], url: URL, empty: boolean) {
  const q = url.searchParams
  const keyword = (q.get('keyword') || q.get('search') || '').toLowerCase()
  const filtered = empty ? [] : rows.filter((row) => {
    if (keyword && !JSON.stringify(row).toLowerCase().includes(keyword)) return false
    for (const key of ['status', 'square_state', 'model_name', 'token_name', 'username', 'group', 'category', 'success', 'task_id', 'request_id', 'platform']) {
      const value = q.get(key)
      if (value && String(row[key]) !== value) return false
    }
    if (q.get('type') && q.get('type') !== '0' && String(row.type) !== q.get('type')) return false
    const stamp = Number(row.created_at ?? row.submit_time ?? 0)
    if (stamp && q.get('start_timestamp') && stamp < Number(q.get('start_timestamp'))) return false
    if (stamp && q.get('end_timestamp') && stamp > Number(q.get('end_timestamp'))) return false
    return true
  })
  const size = Math.max(1, Math.min(1000, Number(q.get('page_size') || q.get('size')) || 20))
  const current = Math.max(1, Number(q.get('p') || q.get('page')) || 1)
  return { items: filtered.slice((current - 1) * size, current * size), total: filtered.length, page: current, page_size: size }
}

// This is a local UI simulator, not an authentication or gateway implementation.
// No requests are forwarded. Unknown endpoints fail visibly rather than pretending to save.
export async function handleMock(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')
  const method = request.method
  const cookies = new Map((request.headers.get('cookie') || '').split(';').map((value) => {
    const [name, ...parts] = value.trim().split('=')
    return [name, parts.join('=')] as const
  }))
  const role = cookies.get('mock_role') || 'admin'
  const scenario = cookies.get('mock_scenario') || 'normal'
  const empty = scenario === 'empty'
  const data = store.data
  const now = Math.floor(Date.now() / 1000)
  const user = { ...mockUser, ...data.users[0], role: role === 'admin' ? 100 : 1 }
  const session = { user, access_token: 'mock-local-ui-only', access_expires_at: now + 86400, session: { sid: 'mock-local-session' } }
  let body: Record<string, unknown> = {}
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && request.headers.get('content-type')?.includes('application/json')) {
    const raw = await request.text()
    try { body = raw ? JSON.parse(raw) : {} } catch { return reply(null, 400, 'Invalid mock JSON') }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(null, 400, 'Expected a JSON object')
  }

  if (path === '/api/__mock') {
    if (method === 'POST') {
      const origin = request.headers.get('origin')
      if (origin && origin !== url.origin) return reply(null, 403, 'Cross-origin mock controls are disabled')
      if (body.reset) resetMockData()
      const response = reply({ reset: !!body.reset })
      for (const [key, allowed] of Object.entries({ role: ['admin', 'user', 'guest'], scenario: ['normal', 'empty', 'error', 'slow'] })) {
        if (typeof body[key] === 'string' && allowed.includes(body[key])) {
          response.headers.append('Set-Cookie', `mock_${key}=${body[key]}; Path=/; SameSite=Strict`)
        }
      }
      response.headers.append('Set-Cookie', `new_api_has_session=${body.role === 'guest' ? '0' : '1'}; Path=/; SameSite=Strict`)
      return response
    }
    return reply({ role, scenario, unhandled: store.unhandled })
  }
  if (path === '/api/user/auth/refresh') return role === 'guest' ? reply(null, 401, 'Mock guest session') : reply(session)
  if (path === '/api/user/auth/logout') {
    const response = reply(null)
    response.headers.append('Set-Cookie', 'mock_role=guest; Path=/; SameSite=Strict')
    response.headers.append('Set-Cookie', 'new_api_has_session=0; Path=/; SameSite=Strict')
    return response
  }
  if (path === '/api/status') return reply({
    setup: true, system_name: 'eva · Mock', version: 'local-mock', start_time: now - 86400,
    server_address: 'http://127.0.0.1:3031', quota_per_unit: 500000, display_in_currency: true,
    display_in_currency_enabled: true, currency: 'CNY', usd_exchange_rate: 7,
    enable_data_export: true, log_export_enabled: true, uptime_kuma_enabled: true,
    password_login: false, password_register: false, email_verification: false, turnstile_check: false,
    checkin_enabled: true, faq_enabled: true, faq: [{ id: 1, question: '这些数据会发送到线上吗？', answer: '不会。这里是独立的本地前端 Mock 工作区。' }],
    HeaderNavModules: '{}', SidebarModulesAdmin: '{}', announcements: [], api_info: [],
  })
  if (path === '/api/setup') return reply({ status: true })
  if (path === '/api/user/self') {
    if (role === 'guest') return reply(null, 401, 'Mock guest session')
    if (method !== 'GET') Object.assign(data.users[0], body)
    return reply({ ...data.users[0], role: user.role })
  }
  if (scenario === 'slow') await new Promise((resolve) => setTimeout(resolve, 1200))
  if (scenario === 'error') return reply(null, 503, 'Mock scenario: service unavailable')
  if (role !== 'admin' && /^\/api\/(channel|models|vendors|option|user\/search)(\/|$)/.test(path)) return reply(null, 403, 'Unauthorized, insufficient privileges')

  if (path === '/api/mock-relay/chat/completions' && method === 'POST') {
    const content = '这是本地 Mock 回复。你可以用它重构聊天气泡、Markdown、代码块和流式状态。\n\n```js\nconsole.log("Hello, mock workspace")\n```\n\n本次请求没有连接任何模型服务。'
    if (body.stream) {
      const chunks = [content.slice(0, 24), content.slice(24)].map((part) => `data: ${JSON.stringify({ id: 'mock-chat', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: part }, finish_reason: null }] })}\n\n`)
      return new Response(chunks.join('') + 'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } })
    }
    return Response.json({ id: 'mock-chat', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 30, total_tokens: 42 } })
  }
  if (path === '/api/mock-relay/images/generations' && method === 'POST') return Response.json({ created: now, data: [{ url: '/mock/sample.svg' }] })
  const editablePath = /^\/api\/(models|channel|vendors|token|user|prefill_group|redemption)(?:\/(\d+))?(?:\/status)?$/.test(path) || ['/api/option', '/api/user/manage'].includes(path)
  if (method !== 'GET' && !editablePath) {
    const marker = `${method} ${path}`
    if (!store.unhandled.includes(marker)) store.unhandled.push(marker)
    return reply(null, 501, `Mock action not implemented: ${marker}`)
  }

  if (path === '/api/catalog/models') {
    const catalog = createCatalog()
    const visible = catalog.models.filter((m) => data.models.find((row) => row.model_name === m.configured_model_id)?.status !== 0)
    catalog.models = empty ? [] : visible
    catalog.total = catalog.models.length
    return reply(catalog)
  }
  if (path === '/api/catalog/usage') return reply({ enabled: false, models: [] })
  if (path === '/api/catalog/notices') return reply([])
  if (path === '/api/pricing') return Response.json({ success: true, model_group: {}, group_ratio: { default: 1, premium: 1.5 }, usable_group: { default: '标准分组', premium: '高级分组' }, auto_groups: ['default'], model_info: {}, data: [] })
  if (path === '/api/skills/eva-models/SKILL.md') return new Response('---\nname: eva-models\ndescription: Local frontend mock fixture\n---\n\n# Mock Skill\n\nThis is synthetic content for previewing the frontend. Do not send real requests.\n', { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
  if (path === '/api/home/stats') return reply({ registered_users: 1280, online_users: 42 })
  if (path === '/api/home_page_content') return reply('')
  if (path === '/api/notice') return reply('当前为本地 Mock 工作区，所有数据均为示例。')
  if (['/api/about', '/api/privacy-policy', '/api/user-agreement'].includes(path)) return reply('# 本地前端 Mock\n\n基于 new-api 前端提取，保留 QuantumNous 项目署名。所有页面使用模拟数据。')
  if (path === '/api/uptime/status') return reply(empty ? [] : [{ categoryName: '本地演示服务', monitors: [{ name: '文本模型', uptime: 99.98, status: 1 }, { name: '多模态模型', uptime: 99.85, status: 1 }] }])
  if (path === '/api/user/models') return reply(modelNames)
  if (path === '/api/user/self/groups') return reply({ default: { ratio: 1, desc: '标准分组' }, premium: { ratio: 1.5, desc: '高级分组' } })
  if (path === '/api/group') return reply(['default', 'premium'])
  if (path === '/api/token/auto-groups') return reply(['default', 'premium'])
  if (/^\/api\/data(\/self|\/users)?$/.test(path)) return reply(empty ? [] : data.usage)
  if (/^\/api\/log(\/self)?\/stat$/.test(path)) return reply({ quota: 12500000, rpm: 24, tpm: 18000 })
  if (/^\/api\/log(\/self)?$/.test(path)) return reply(page(data.logs, url, empty))
  if (/^\/api\/audit(\/self)?$/.test(path)) return reply(page(data.audits, url, empty))
  if (/^\/api\/task(\/self)?$/.test(path)) return reply(page(data.tasks, url, empty))
  if (/^\/api\/mj(\/self)?$/.test(path)) return reply(page(data.drawings, url, empty))
  if (/^\/api\/task\/[^/]+\/artifacts$/.test(path)) return reply({ artifacts: [{ key: 'mock-image', type: 'image', mime_type: 'image/svg+xml', content_url: '/mock/sample.svg' }] })
  if (path === '/api/perf-metrics/summary') return reply({
    models: empty ? [] : modelNames.map((model_name, i) => ({ model_name, avg_latency_ms: 240 + i * 32, success_rate: 99.9 - i * .08, avg_tps: 60 + i * 4, has_tps: true, total_requests: 1200 - i * 30 })),
    groups: ['default', 'premium'], summary: { avg_latency_ms: 360, success_rate: 99.8, avg_tps: 72, total_requests: 8426 },
  })
  if (path === '/api/perf-metrics') {
    const hours = Number(url.searchParams.get('hours')) || 24
    const summary = { avg_latency_ms: 360, success_rate: 99.8, avg_tps: 72 }
    const series = empty ? [] : Array.from({ length: 12 }, (_, i) => ({ ts: now - (11 - i) * hours * 300, ...summary, avg_latency_ms: 280 + i * 12, avg_ttft_ms: 180 + i * 8 }))
    return reply({ model_name: url.searchParams.get('model'), groups: [{ group: 'default', ...summary, avg_ttft_ms: 200, series }], summary, series, window_start: now - hours * 3600, window_end: now, series_schema: 'v1' })
  }

  if (path === '/api/option/video_storage') return reply({
    configured: true, enabled: data.options.find((o) => o.key === 'VideoStorageEnabled')?.value !== 'false',
    bucket_host: 'mock-bucket.example.invalid', sources: ['mock'], signed_url_hours: 24,
    channels: data.channels.slice(0, 4).map((c) => ({ id: c.id, name: c.name, status: c.status, storage_enabled: true, direct_only: false })),
    usage: { status: 'ready', used_bytes: 2147483648, object_count: 128, updated_at: now, refreshing: false },
  })
  if (path === '/api/option') {
    if (method === 'PUT') {
      const option = data.options.find((o) => o.key === body.key)
      if (option) option.value = body.value
      else data.options.push({ id: data.options.length + 1, key: body.key, value: body.value })
    }
    return reply(data.options)
  }
  if (path === '/api/option/model_pricing') return reply({ entries: modelNames.map((model_name) => ({ model_name, version: 'mock-v1', configured: {}, effective: {} })), empty_version: 'mock-v1' })
  if (path === '/api/option/request_policy') return reply({ rules: [], enabled: false })
  if (path === '/api/channel/priority/order') return reply(data.channels)
  if (/^\/api\/channel\/test(\/\d+)?$/.test(path)) return reply({ time: 0.24 })
  if (/^\/api\/channel\/fetch_models\/\d+$/.test(path)) return reply(modelNames)
  if (path === '/api/task_plugin_options') return reply([])
  if (/^\/api\/token\/\d+\/key$/.test(path)) return reply({ key: `mock-not-a-real-api-key-${path.split('/')[3]}` })

  const collections: Record<string, MockRow[]> = {
    models: data.models, channel: data.channels, vendors: data.vendors, token: data.tokens,
    user: data.users, prefill_group: data.groups, redemption: data.redemptions,
  }
  const match = path.match(/^\/api\/(models|channel|vendors|token|user|prefill_group|redemption)(?:\/(search|\d+))?(?:\/(status))?$/)
  if (match) {
    const rows = collections[match[1]]
    const id = Number(match[2] === 'search' ? 0 : match[2]) || Number(body.id)
    if (method === 'GET') {
      if (id) return rows.find((row) => row.id === id) ? reply(rows.find((row) => row.id === id)) : reply(null, 404, 'Mock record not found')
      if (match[1] === 'prefill_group') return reply(empty ? [] : rows)
      return reply(page(rows, url, empty))
    }
    if (method === 'DELETE') {
      const index = rows.findIndex((row) => row.id === id)
      if (index === -1) return reply(null, 404, 'Mock record not found')
      rows.splice(index, 1)
      return reply(null)
    }
    if (method === 'PUT' || method === 'PATCH') {
      const row = rows.find((row) => row.id === id)
      if (!row) return reply(null, 404, 'Mock record not found')
      Object.assign(row, body, { id })
      if (match[1] === 'models' && body.status !== undefined) row.square_state = body.status === 1 ? 'visible' : 'hidden'
      return reply(row)
    }
    if (method === 'POST') {
      const input = match[1] === 'channel' && body.channel ? body.channel as Record<string, unknown> : body
      const row = { ...input, id: Math.max(0, ...rows.map((row) => row.id)) + 1, status: input.status ?? 1, created_time: now }
      rows.unshift(row)
      return reply(row)
    }
  }
  if (path === '/api/user/manage') {
    const target = data.users.find((row) => row.id === Number(body.id))
    if (!target) return reply(null, 404, 'Mock user not found')
    if (body.action === 'disable') target.status = 2
    else if (body.action === 'enable') target.status = 1
    else return reply(null, 501, 'This user action is not simulated')
    return reply(target)
  }
  if (path === '/api/user/topup/info') return reply({ enable_online_topup: false, enable_stripe_topup: false, enable_creem_topup: false, enable_waffo_topup: false, pay_methods: [], amount_options: [10, 50, 100], discount: {}, min_topup: 1 })
  if (path === '/api/subscription/self') return reply({ active_subscriptions: [], all_subscriptions: [], billing_preference: 'balance_first' })
  if (['/api/subscription/plans', '/api/subscription/admin/plans'].includes(path)) return reply([])
  if (path === '/api/user/checkin') return reply({ enabled: true, stats: { total_checkins: 12, total_quota: 500000, checked_in_today: true, checkin_count: 3, records: [] } })
  if (path === '/api/user/2fa/status') return reply({ enabled: false })
  if (path === '/api/user/passkey') return reply({ enabled: false, credentials: [] })
  if (['/api/user/sessions', '/api/user/oauth/bindings', '/api/user/access_tokens'].includes(path)) return reply([])
  if (path === '/api/user/aff') return reply('mock-demo')
  if (path === '/api/user/topup/self' || path === '/api/user/topup') return method === 'GET' ? reply(page([], url, true)) : reply(null, 501, 'Payments are not performed in the mock workspace')
  if (path === '/api/playground/uploads/config') return reply({ enabled: false, max_file_size: 10485760, allowed_extensions: [] })
  if (path === '/api/playground/uploads/face-processing/config') return reply({ enabled: false })
  if (['/api/developer-docs/published', '/api/rest-api/published'].includes(path)) return reply([])
  if (path === '/api/news') return reply({ articles: [] })
  if (path === '/api/rankings') return reply({ period: url.searchParams.get('period') || 'week', models: [], vendors: [], top_movers: [], top_droppers: [], history: { points: [], models: [], buckets: 0 }, vendor_history: { points: [], vendors: [], buckets: 0 }, total_tokens: 0, updated_at: now })
  if (path === '/api/plugin/task') return reply([])
  if (path === '/api/plugin/task/runtime/status') return reply({ enabled: false, ready: false, plugins: [] })
  if (path === '/api/deployments/settings') return reply({ enabled: false, configured: false })
  if (path === '/api/system-task/list') return reply(page([], url, true))
  if (path === '/api/system-info/instances') return reply([])
  if (path === '/api/performance/stats') return reply({
    cache_stats: { active_disk_files: 12, current_disk_usage_bytes: 10485760, active_memory_buffers: 8, current_memory_usage_bytes: 4194304, disk_cache_hits: 240, memory_cache_hits: 3600, disk_cache_max_bytes: 1073741824, disk_cache_threshold_bytes: 10485760 },
    memory_stats: { alloc: 67108864, total_alloc: 134217728, sys: 268435456, num_gc: 24, num_goroutine: 42 },
    disk_cache_info: { path: '/mock/cache', exists: true, file_count: 12, total_size: 10485760 },
    disk_space_info: { total: 10737418240, free: 8589934592, used: 2147483648, used_percent: 20 },
    config: { disk_cache_enabled: true, monitor_enabled: true, disk_cache_threshold_mb: 10, disk_cache_max_size_mb: 1024, disk_cache_path: '/mock/cache', is_running_in_container: false, monitor_cpu_threshold: 80, monitor_memory_threshold: 80, monitor_disk_threshold: 85 },
  })

  const marker = `${method} ${path}`
  if (!store.unhandled.includes(marker)) store.unhandled.push(marker)
  store.unhandled = store.unhandled.slice(-60)
  return reply(null, 501, `Mock endpoint not implemented: ${marker}`)
}
