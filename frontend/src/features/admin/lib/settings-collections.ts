export const settingsStringListKeys = new Set(['fetch_setting.domain_list', 'fetch_setting.ip_list', 'fetch_setting.allowed_ports'])

export interface CollectionField {
  key: string
  label: string
  kind?: 'textarea' | 'number' | 'select' | 'string-list'
  choices?: string[]
  optional?: boolean
  max?: number
}
export interface CollectionSpec {
  fields: CollectionField[]
  limit?: number
  id?: boolean
  defaults?: Record<string, unknown>
}
export const settingsCollections: Record<string, CollectionSpec> = {
  OrbisCatalogNotices: {
    defaults: { models: [], groups: [], offering_keys: [] },
    fields: [
      { key: 'public_message', label: 'Message', kind: 'textarea' },
      { key: 'reason', label: 'Reason', optional: true },
      { key: 'models', label: 'Models', kind: 'string-list', optional: true },
      { key: 'groups', label: 'Group', kind: 'string-list', optional: true },
      { key: 'offering_keys', label: 'Offering key', kind: 'string-list', optional: true },
    ],
  },
  EvaNewsArticles: {
    limit: 100,
    id: true,
    defaults: { status: 'draft' },
    fields: [
      { key: 'slug', label: 'Article slug', max: 96 },
      { key: 'title', label: 'Title', max: 160 },
      { key: 'excerpt', label: 'Excerpt', kind: 'textarea', optional: true, max: 500 },
      { key: 'body', label: 'Article content (Markdown or HTML)', kind: 'textarea', optional: true, max: 100000 },
      { key: 'status', label: 'Status', kind: 'select', choices: ['draft', 'published'] },
      { key: 'published_at', label: 'Publish date (ISO 8601)', optional: true },
    ],
  },
  'console_setting.announcements': {
    limit: 100,
    id: true,
    defaults: { type: 'default' },
    fields: [
      { key: 'content', label: 'Content', kind: 'textarea', max: 500 },
      { key: 'publishDate', label: 'Publish date (ISO 8601)' },
      { key: 'type', label: 'Type', kind: 'select', choices: ['default', 'ongoing', 'success', 'warning', 'error'], optional: true },
      { key: 'extra', label: 'Extra information', optional: true, max: 100 },
    ],
  },
  'console_setting.faq': {
    limit: 100,
    id: true,
    fields: [
      { key: 'question', label: 'Question', max: 200 },
      { key: 'answer', label: 'Answer', kind: 'textarea', max: 1000 },
    ],
  },
  'console_setting.api_info': {
    limit: 50,
    id: true,
    defaults: { color: 'blue' },
    fields: [
      { key: 'url', label: 'URL', max: 500 },
      { key: 'route', label: 'Route', max: 100 },
      { key: 'description', label: 'Description', max: 200 },
      {
        key: 'color',
        label: 'Color',
        kind: 'select',
        choices: [
          'blue',
          'green',
          'cyan',
          'purple',
          'pink',
          'red',
          'orange',
          'amber',
          'yellow',
          'lime',
          'light-green',
          'teal',
          'light-blue',
          'indigo',
          'violet',
          'grey',
          'slate',
        ],
      },
    ],
  },
  'console_setting.uptime_kuma_groups': {
    limit: 20,
    fields: [
      { key: 'categoryName', label: 'Category name', max: 50 },
      { key: 'url', label: 'URL', max: 500 },
      { key: 'slug', label: 'Status page slug', max: 100 },
      { key: 'description', label: 'Description', optional: true, max: 200 },
    ],
  },
  PayMethods: {
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'icon', label: 'Icon URL', optional: true },
      { key: 'min_topup', label: 'Minimum top-up amount', optional: true },
      { key: 'color', label: 'Color', optional: true },
    ],
  },
  WaffoPayMethods: {
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'icon', label: 'Icon URL', optional: true },
      { key: 'payMethodType', label: 'Payment method type' },
      { key: 'payMethodName', label: 'Payment method name', optional: true },
    ],
  },
  CreemProducts: {
    defaults: { price: 1, quota: 1, currency: 'USD' },
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'productId', label: 'Product ID' },
      { key: 'price', label: 'Price', kind: 'number' },
      { key: 'quota', label: 'Quota', kind: 'number' },
      { key: 'currency', label: 'Currency', kind: 'select', choices: ['USD', 'EUR'] },
    ],
  },
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function validateSettingsUrl(value: string, originOnly = false) {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (originOnly && (url.pathname !== '/' || url.search || url.hash)))
    throw new Error('Invalid URL')
}

/** Validate the complete draft before the first native option write. Unknown object properties survive unchanged. */
export function validateSettingsCollection(key: string, value: unknown) {
  if (key === 'tool_price_setting.prices') {
    if (!isRecord(value) || Object.values(value).some((price) => typeof price !== 'number' || !Number.isFinite(price) || price < 0))
      throw new Error('Tool prices must be finite non-negative numbers')
    return
  }
  if (settingsStringListKeys.has(key)) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error('Expected a JSON array of strings')
    if (key === 'fetch_setting.allowed_ports')
      for (const item of value as string[]) {
        const port = item.trim()
        if (!port) continue // The native parser ignores blank entries.
        const bounds = port.split('-').map((part) => part.trim())
        if (
          bounds.length > 2 ||
          bounds.some((bound) => !/^\+?\d+$/.test(bound) || Number(bound) < 1 || Number(bound) > 65535) ||
          (bounds.length === 2 && Number(bounds[0]) > Number(bounds[1]))
        )
          throw new Error('Use ports from 1 to 65535 or ascending port ranges')
      }
    return
  }
  if (['global.thinking_model_blacklist', 'global.effort_tail_model_ids', 'gemini.supported_imagine_models'].includes(key)) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error('Expected a JSON array of model identifiers')
    return
  }
  if (key === 'ModelRequestRateLimitGroup') {
    if (
      !isRecord(value) ||
      Object.entries(value).some(
        ([group, limits]) =>
          !group.trim() ||
          !Array.isArray(limits) ||
          limits.length !== 2 ||
          limits.some((limit) => !Number.isSafeInteger(limit) || limit > 2147483647) ||
          limits[0] < 0 ||
          limits[1] < 1
      )
    )
      throw new Error('Invalid group rate limits')
    return
  }
  if (
    [
      'claude.default_max_tokens',
      'claude.model_headers_settings',
      'gemini.safety_settings',
      'gemini.version_settings',
      'global.chat_completions_to_responses_policy',
      'HeaderNavModules',
      'SidebarModulesAdmin',
    ].includes(key)
  ) {
    if (!isRecord(value)) throw new Error('Expected a JSON object')
    if (key === 'claude.default_max_tokens' && Object.values(value).some((tokens) => !Number.isSafeInteger(tokens) || Number(tokens) < 0))
      throw new Error('Invalid numeric setting')
    if (
      key === 'claude.model_headers_settings' &&
      Object.values(value).some(
        (headers) =>
          !isRecord(headers) ||
          Object.values(headers).some((items) => !Array.isArray(items) || items.some((item) => typeof item !== 'string' || /[\r\n]/.test(item)))
      )
    )
      throw new Error('Invalid request header overrides')
    if (key === 'gemini.version_settings' && Object.values(value).some((version) => typeof version !== 'string'))
      throw new Error('Invalid collection field')
    if (
      key === 'gemini.safety_settings' &&
      Object.values(value).some(
        (threshold) =>
          typeof threshold !== 'string' ||
          !['', 'OFF', 'BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE', 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'].includes(
            threshold
          )
      )
    )
      throw new Error('Invalid Gemini safety threshold')
    if (key === 'global.chat_completions_to_responses_policy') {
      for (const flag of ['enabled', 'all_channels'])
        if (value[flag] !== undefined && typeof value[flag] !== 'boolean') throw new Error('Invalid collection field')
      for (const ids of ['channel_ids', 'channel_types'])
        if (value[ids] !== undefined && (!Array.isArray(value[ids]) || value[ids].some((id) => !Number.isSafeInteger(id) || id <= 0)))
          throw new Error('Invalid collection field')
      if (
        value.model_patterns !== undefined &&
        (!Array.isArray(value.model_patterns) || value.model_patterns.some((pattern) => typeof pattern !== 'string'))
      )
        throw new Error('Invalid collection field')
    }
    return
  }
  if (key === 'payment_setting.amount_discount') {
    if (
      !isRecord(value) ||
      Object.entries(value).some(
        ([amount, discount]) =>
          !/^[1-9]\d*$/.test(amount) ||
          !Number.isSafeInteger(Number(amount)) ||
          typeof discount !== 'number' ||
          !Number.isFinite(discount) ||
          discount <= 0 ||
          discount > 1
      )
    )
      throw new Error('Invalid recharge discount')
    return
  }
  if (!Array.isArray(value)) throw new Error('Expected a JSON array')
  if (key === 'payment_setting.amount_options') {
    if (value.some((amount) => !Number.isSafeInteger(amount) || amount <= 0) || new Set(value).size !== value.length)
      throw new Error('Invalid recharge amounts')
    return
  }
  if (key === 'Chats') {
    if (
      value.some(
        (row) =>
          !isRecord(row) ||
          Object.keys(row).length !== 1 ||
          Object.entries(row).some(([name, url]) => !name.trim() || typeof url !== 'string' || !url.trim())
      )
    )
      throw new Error('Invalid chat preset')
    return
  }
  const spec = settingsCollections[key]
  if (!spec) return
  if (spec.limit && value.length > spec.limit) throw new Error('Too many items')
  const categories = new Set<string>()
  const newsIds = new Set<number>()
  for (const row of value) {
    if (!isRecord(row)) throw new Error('Each item must be an object')
    if (key === 'EvaNewsArticles') {
      if (
        !Number.isSafeInteger(row.id) ||
        Number(row.id) <= 0 ||
        newsIds.has(Number(row.id)) ||
        !/^[a-z0-9][a-z0-9-]{0,95}$/.test(String(row.slug)) ||
        categories.has(String(row.slug))
      )
        throw new Error('Invalid news articles')
      if (
        row.published_at &&
        (typeof row.published_at !== 'string' ||
          !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(row.published_at) ||
          !Number.isFinite(Date.parse(row.published_at)))
      )
        throw new Error('Invalid news publish date')
      if (row.status === 'published' && (!row.published_at || typeof row.body !== 'string' || !row.body.trim()))
        throw new Error('Published articles need content and a publish date')
      newsIds.add(Number(row.id))
      categories.add(String(row.slug))
    }
    for (const field of spec.fields) {
      const content = row[field.key]
      if (field.optional && content === undefined) continue
      if (field.kind === 'string-list') {
        if (!Array.isArray(content) || content.some((item) => typeof item !== 'string' || !item.trim())) throw new Error('Invalid collection field')
      } else if (field.kind === 'number') {
        if (typeof content !== 'number' || !Number.isFinite(content) || content < (field.key === 'quota' ? 1 : 0.01))
          throw new Error('Invalid numeric setting')
      } else if (
        typeof content !== 'string' ||
        (!field.optional && !content.trim()) ||
        (field.max && content.length > field.max) ||
        (field.choices && !field.choices.includes(content))
      )
        throw new Error('Invalid collection field')
    }
    if (
      key === 'PayMethods' &&
      row.min_topup !== undefined &&
      row.min_topup !== '' &&
      (!Number.isFinite(Number(row.min_topup)) || Number(row.min_topup) < 0)
    )
      throw new Error('Invalid numeric setting')
    if (
      key === 'console_setting.announcements' &&
      (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(String(row.publishDate)) ||
        !Number.isFinite(Date.parse(String(row.publishDate))))
    )
      throw new Error('Invalid publish date')
    if (key === 'console_setting.api_info' || key === 'console_setting.uptime_kuma_groups') {
      validateSettingsUrl(String(row.url))
      for (const name of ['route', 'description', 'categoryName'])
        if (typeof row[name] === 'string' && /<script|<iframe|javascript:|onload=|onerror=|onclick=/i.test(row[name]))
          throw new Error('Invalid collection field')
    }
    if (key === 'console_setting.uptime_kuma_groups') {
      if (!/^[a-zA-Z0-9_-]+$/.test(String(row.slug)) || categories.has(String(row.categoryName))) throw new Error('Invalid status page group')
      categories.add(String(row.categoryName))
    }
  }
}
