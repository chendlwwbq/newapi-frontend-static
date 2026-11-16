import { describe, expect, it } from 'vitest'
import { settingsSections } from '../settings-schema'
import { prepareOptionChanges, projectOptionValues } from './settings-options'
import { parseAccessPolicy } from './access-policy'
import { parseAffinityRules, type AffinityRule } from './affinity-rules'

const baseline = (section: string) =>
  Object.fromEntries(
    settingsSections[section].fields.map((field) => [
      field.key,
      field.kind === 'boolean' ? 'false' : field.key === 'SMTPPort' ? '587' : field.key === 'EmailProvider' ? 'smtp' : '',
    ])
  )

describe('native settings updates', () => {
  it('preserves native drawing switches and validates dashboard controls before enabling them', () => {
    const drawing = {
      DrawingEnabled: 'false',
      MjNotifyEnabled: 'false',
      MjAccountFilterEnabled: 'false',
      MjForwardUrlEnabled: 'true',
      MjModeClearEnabled: 'false',
      MjActionCheckSuccessEnabled: 'true',
    }
    const changes = prepareOptionChanges(
      settingsSections.drawing,
      drawing,
      { ...drawing, DrawingEnabled: 'true', MjNotifyEnabled: 'true' },
      new Set()
    )
    expect(changes).toEqual([
      { key: 'MjNotifyEnabled', value: true },
      { key: 'DrawingEnabled', value: true },
    ])
    const dashboard = { DataExportEnabled: 'false', DataExportInterval: '5', DataExportDefaultTime: 'hour' }
    expect(
      prepareOptionChanges(settingsSections.content, dashboard, { ...dashboard, DataExportInterval: '10', DataExportEnabled: 'true' }, new Set()).map(
        (change) => change.key
      )
    ).toEqual(['DataExportInterval', 'DataExportEnabled'])
    expect(() => prepareOptionChanges(settingsSections.content, dashboard, { ...dashboard, DataExportInterval: '0' }, new Set())).toThrow(
      'Invalid numeric setting'
    )
  })
  it('validates check-in rewards and writes the range before enabling', () => {
    const initial = { 'checkin_setting.enabled': 'false', 'checkin_setting.min_quota': '1000', 'checkin_setting.max_quota': '10000' }
    const next = { ...initial, 'checkin_setting.enabled': 'true', 'checkin_setting.min_quota': '50000', 'checkin_setting.max_quota': '60000' }
    expect(prepareOptionChanges(settingsSections.checkin, initial, next, new Set()).map((change) => change.key)).toEqual([
      'checkin_setting.max_quota',
      'checkin_setting.min_quota',
      'checkin_setting.enabled',
    ])
    expect(() => prepareOptionChanges(settingsSections.checkin, initial, { ...next, 'checkin_setting.max_quota': '4' }, new Set())).toThrow(
      'Invalid numeric setting'
    )
    expect(() => prepareOptionChanges(settingsSections.checkin, initial, { ...next, 'checkin_setting.min_quota': '-1' }, new Set())).toThrow(
      'Invalid numeric setting'
    )
  })
  it('prepares scoped catalog notices while preserving extension fields', () => {
    const key = 'OrbisCatalogNotices',
      initial = { [key]: '[]' }
    const notices = [
      {
        public_message: 'Maintenance',
        models: ['model/132'],
        groups: ['primary'],
        offering_keys: ['channel-1/route'],
        extension: { retained: true },
      },
    ]
    expect(projectOptionValues([{ key, value: JSON.stringify(notices) }], settingsSections)[key]).toBe(JSON.stringify(notices))
    expect(prepareOptionChanges(settingsSections.content, initial, { [key]: JSON.stringify(notices) }, new Set())).toEqual([
      { key, value: JSON.stringify(notices) },
    ])
    expect(() => prepareOptionChanges(settingsSections.content, initial, { [key]: '[{"public_message":"Notice","groups":[3]}]' }, new Set())).toThrow(
      'Invalid collection field'
    )
  })
  it('keeps server-withheld credentials out of the cached projection', () => {
    const result = projectOptionValues(
      ['SystemName', 'SMTPToken', 'ResendApiKey', 'TurnstileSiteKey', 'TurnstileSecretKey', 'ResendKeyConfigured', 'UnknownOption'].map((key) => ({
        key,
        value: key,
      })),
      settingsSections
    )
    expect(result).toEqual({ SystemName: 'SystemName', ResendKeyConfigured: 'ResendKeyConfigured' })
  })
  it('does not overwrite an existing credential with a blank input', () => {
    const initial = baseline('email')
    expect(prepareOptionChanges(settingsSections.email, initial, { ...initial, SMTPFrom: 'sender@example.test' }, new Set())).toEqual([
      { key: 'SMTPFrom', value: 'sender@example.test' },
    ])
  })
  it('only sends a blank credential after explicit clear intent', () => {
    const initial = baseline('email')
    expect(prepareOptionChanges(settingsSections.email, initial, initial, new Set(['SMTPToken']))).toEqual([{ key: 'SMTPToken', value: '' }])
  })
  it('saves Turnstile credentials before enabling the check', () => {
    const initial = baseline('authentication')
    expect(
      prepareOptionChanges(
        settingsSections.authentication,
        initial,
        { ...initial, TurnstileSiteKey: 'local-site', TurnstileSecretKey: 'local-only', TurnstileCheckEnabled: 'true' },
        new Set()
      ).map((change) => change.key)
    ).toEqual(['TurnstileSiteKey', 'TurnstileSecretKey', 'TurnstileCheckEnabled'])
  })
  it('disables checks before removing their settings', () => {
    const initial = { ...baseline('authentication'), TurnstileCheckEnabled: 'true' }
    expect(
      prepareOptionChanges(
        settingsSections.authentication,
        initial,
        { ...initial, TurnstileCheckEnabled: 'false' },
        new Set(['TurnstileSecretKey'])
      ).map((change) => change.key)
    ).toEqual(['TurnstileCheckEnabled', 'TurnstileSecretKey'])
  })
  it('saves Resend prerequisites before switching providers', () => {
    const initial = baseline('email')
    expect(
      prepareOptionChanges(
        settingsSections.email,
        initial,
        { ...initial, EmailProvider: 'resend', ResendFrom: 'Eva <sender@example.test>', ResendApiKey: 'fixture-key' },
        new Set()
      ).map((change) => change.key)
    ).toEqual(['ResendFrom', 'ResendApiKey', 'EmailProvider'])
  })
  it('switches away from Resend before clearing its active key', () => {
    const initial = { ...baseline('email'), EmailProvider: 'resend' }
    expect(prepareOptionChanges(settingsSections.email, initial, { ...initial, EmailProvider: 'smtp' }, new Set(['ResendApiKey']))).toEqual([
      { key: 'EmailProvider', value: 'smtp' },
      { key: 'ResendApiKey', value: '' },
    ])
  })
  it('normalizes domain lists before enabling restrictions', () => {
    const initial = baseline('authentication')
    expect(
      prepareOptionChanges(
        settingsSections.authentication,
        initial,
        { ...initial, EmailDomainRestrictionEnabled: 'true', EmailDomainWhitelist: ' example.test\n second.test,\n' },
        new Set()
      )
    ).toEqual([
      { key: 'EmailDomainWhitelist', value: 'example.test,second.test' },
      { key: 'EmailDomainRestrictionEnabled', value: true },
    ])
  })
  it.each(['', 'NaN', '1.5', '0', '65536'])('rejects invalid SMTP port %j before any write', (port) => {
    const initial = baseline('email')
    expect(() =>
      prepareOptionChanges(settingsSections.email, initial, { ...initial, SMTPPort: port, SMTPServer: 'mail.example.test' }, new Set())
    ).toThrow('Invalid numeric setting')
  })
  it('preserves false and zero values for existing settings', () => {
    const initial = { RetryTimes: '1', AutomaticDisableChannelEnabled: 'true' }
    const section = { title: 'Policy', fields: settingsSections['request-policies'].fields.filter((field) => field.key in initial) }
    expect(prepareOptionChanges(section, initial, { RetryTimes: '0', AutomaticDisableChannelEnabled: 'false' }, new Set())).toEqual([
      { key: 'RetryTimes', value: 0 },
      { key: 'AutomaticDisableChannelEnabled', value: false },
    ])
  })
  it('keeps all built-in OAuth credentials out of the cache even if returned', () => {
    const keys = settingsSections.oauth.fields.filter((field) => field.writeOnly).map((field) => field.key)
    expect(
      projectOptionValues(
        keys.map((key) => ({ key, value: 'should-not-be-cached' })),
        settingsSections
      )
    ).toEqual({})
  })
  it('configures OAuth credentials before enabling providers', () => {
    const initial = baseline('oauth')
    const changes = prepareOptionChanges(
      settingsSections.oauth,
      initial,
      {
        ...initial,
        GitHubOAuthEnabled: 'true',
        GitHubClientId: 'client',
        GitHubClientSecret: 'secret',
        'telegram.client_id': 'telegram-client',
        'telegram.client_secret': 'telegram-secret',
        TelegramOAuthEnabled: 'true',
      },
      new Set()
    )
    const enable = changes.findIndex((change) => change.key === 'GitHubOAuthEnabled')
    expect(changes.slice(0, enable).map((change) => change.key)).toEqual([
      'GitHubClientId',
      'GitHubClientSecret',
      'telegram.client_id',
      'telegram.client_secret',
    ])
    expect(changes.slice(enable).map((change) => change.key)).toEqual(['GitHubOAuthEnabled', 'TelegramOAuthEnabled'])
  })
  it('disables OAuth before clearing secrets without touching other providers', () => {
    const initial = { ...baseline('oauth'), GitHubOAuthEnabled: 'true' }
    expect(
      prepareOptionChanges(settingsSections.oauth, initial, { ...initial, GitHubOAuthEnabled: 'false' }, new Set(['GitHubClientSecret']))
    ).toEqual([
      { key: 'GitHubOAuthEnabled', value: false },
      { key: 'GitHubClientSecret', value: '' },
    ])
  })
  it('does not submit Passkey domains through individual option writes', () => {
    expect(settingsSections.passkey.fields.map((field) => field.key)).not.toContain('passkey.rp_id')
    expect(
      projectOptionValues(
        [
          { key: 'passkey.rp_id', value: 'example.test' },
          { key: 'passkey.origins', value: 'https://example.test' },
        ],
        settingsSections
      )
    ).toEqual({ 'passkey.rp_id': 'example.test', 'passkey.origins': 'https://example.test' })
  })
})

describe('structured native policy drafts', () => {
  it('preserves nested OAuth conditions, typed values and extension fields', () => {
    const policy = {
      logic: 'OR',
      extension: { enabled: false },
      conditions: [{ field: 'level', op: 'gte', value: 0, extension: 'keep' }],
      groups: [
        {
          logic: 'and',
          conditions: [
            { field: 'active', op: 'eq', value: false },
            { field: 'org', op: 'in', value: ['core', 'ops'] },
          ],
          extension: 1,
        },
      ],
    }
    expect(parseAccessPolicy(JSON.stringify(policy))).toEqual(policy)
  })
  it.each(['{', '[]', 'null', '{"logic":"xor"}', '{"conditions":[{"field":"role","op":"future"}]}'])(
    'leaves unsupported OAuth JSON in the raw editor: %s',
    (value) => {
      expect(parseAccessPolicy(value)).toBeNull()
    }
  )
  it('preserves affinity order, legacy mode, zero values and extension properties', () => {
    const rules = [
      {
        name: 'legacy',
        session_mode: '',
        ttl_seconds: 0,
        skip_retry_on_failure: false,
        model_regex: ['^gpt-.*$'],
        key_sources: [{ type: 'gjson', path: 'metadata.user_id', extension: true }],
        param_override_template: { operations: [] },
        extension: { a: 0 },
      },
      { name: 'inherited', session_mode: 'inherit', user_agent_include: null },
    ]
    expect(parseAffinityRules(JSON.stringify(rules))).toEqual(rules)
    const edited: AffinityRule = { ...parseAffinityRules(JSON.stringify(rules))![0], name: 'renamed' }
    expect(edited.extension).toEqual({ a: 0 })
    expect(edited.session_mode).toBe('')
    expect(edited.skip_retry_on_failure).toBe(false)
  })
  it.each(['{}', '[{"key_sources":[{"type":"future"}]}]', '[{"model_regex":"^gpt"}]', '[{"ttl_seconds":"0"}]', '[{"session_mode":"future"}]'])(
    'keeps unsupported affinity rules available as raw JSON: %s',
    (value) => {
      expect(parseAffinityRules(value)).toBeNull()
    }
  )
})

describe('tool prices, outbound policies and runtime configuration', () => {
  it('saves only operator overrides, preserving zero and fractional model-prefix prices', () => {
    const key = 'tool_price_setting.prices',
      initial = { [key]: '{}' }
    const prices = { web_search: 0, 'web_search:eva-*': 0.125, 'web_search:eva-fast*': 0 }
    expect(prepareOptionChanges(settingsSections['tool-prices'], initial, { [key]: JSON.stringify(prices) }, new Set())).toEqual([
      { key, value: JSON.stringify(prices) },
    ])
    expect(prepareOptionChanges(settingsSections['tool-prices'], { [key]: JSON.stringify(prices) }, initial, new Set())).toEqual([
      { key, value: '{}' },
    ])
  })
  it.each(['{"web_search":-1}', '{"web_search":"0"}', '{"web_search":null}', '{"web_search":1e400}', '[]'])(
    'rejects malformed tool prices before writing: %s',
    (value) => {
      const key = 'tool_price_setting.prices'
      expect(() => prepareOptionChanges(settingsSections['tool-prices'], { [key]: '{}' }, { [key]: value }, new Set())).toThrow(
        'Tool prices must be finite non-negative numbers'
      )
    }
  )
  it('retains domain wildcards, IPv6 CIDRs and string port ranges without numeric coercion', () => {
    const initial = { 'fetch_setting.domain_list': '[]', 'fetch_setting.ip_list': '[]', 'fetch_setting.allowed_ports': '[]' }
    const draft = {
      'fetch_setting.domain_list': '["*.example.test"]',
      'fetch_setting.ip_list': '["2001:db8::/32","203.0.113.8"]',
      'fetch_setting.allowed_ports': '["443","8000-9000"," 9001 - 9002 "]',
    }
    expect(prepareOptionChanges(settingsSections.network, initial, draft, new Set())).toEqual(
      Object.entries(draft).map(([key, value]) => ({ key, value }))
    )
  })
  it.each(['[443]', '["0"]', '["65536"]', '["9000-8000"]', '["80-81-82"]', '["443x"]'])(
    'rejects invalid allowed ports before any native write: %s',
    (value) => {
      const key = 'fetch_setting.allowed_ports'
      expect(() => prepareOptionChanges(settingsSections.network, { [key]: '[]' }, { [key]: value }, new Set())).toThrow()
    }
  )
  it('saves outbound rules before enabling protection and disables protection first', () => {
    const flag = 'fetch_setting.enable_ssrf_protection',
      list = 'fetch_setting.allowed_ports'
    expect(
      prepareOptionChanges(settingsSections.network, { [flag]: 'false', [list]: '[]' }, { [flag]: 'true', [list]: '["443"]' }, new Set()).map(
        (change) => change.key
      )
    ).toEqual([list, flag])
    expect(
      prepareOptionChanges(settingsSections.network, { [flag]: 'true', [list]: '["443"]' }, { [flag]: 'false', [list]: '[]' }, new Set()).map(
        (change) => change.key
      )
    ).toEqual([flag, list])
  })
  it('keeps Worker and deployment keys out of cached data and preserves blank keys', () => {
    const keys = ['WorkerValidKey', 'model_deployment.ionet.api_key']
    expect(
      projectOptionValues(
        keys.map((key) => ({ key, value: 'private' })),
        settingsSections
      )
    ).toEqual({})
    const initial = { WorkerValidKey: '', WorkerUrl: '' }
    expect(
      prepareOptionChanges(settingsSections.operations, initial, { ...initial, WorkerUrl: ' https://worker.example.test/base/// ' }, new Set())
    ).toEqual([{ key: 'WorkerUrl', value: 'https://worker.example.test/base' }])
    expect(prepareOptionChanges(settingsSections.operations, initial, initial, new Set(['WorkerValidKey']))).toEqual([
      { key: 'WorkerValidKey', value: '' },
    ])
  })
  it('writes the deployment key before enabling io.net without creating a deployment', () => {
    const flag = 'model_deployment.ionet.enabled',
      key = 'model_deployment.ionet.api_key'
    expect(prepareOptionChanges(settingsSections.models, { [flag]: 'false', [key]: '' }, { [flag]: 'true', [key]: 'local-only' }, new Set())).toEqual(
      [
        { key, value: 'local-only' },
        { key: flag, value: true },
      ]
    )
  })
  it('preserves zero metrics retention and validates flush intervals and bucket choices', () => {
    const key = 'perf_metrics_setting.retention_days',
      flush = 'perf_metrics_setting.flush_interval',
      bucket = 'perf_metrics_setting.bucket_time'
    expect(prepareOptionChanges(settingsSections.operations, { [key]: '7' }, { [key]: '0' }, new Set())).toEqual([{ key, value: 0 }])
    expect(() => prepareOptionChanges(settingsSections.operations, { [flush]: '5' }, { [flush]: '0' }, new Set())).toThrow()
    expect(() => prepareOptionChanges(settingsSections.operations, { [bucket]: 'hour' }, { [bucket]: 'second' }, new Set())).toThrow()
  })
  it('accepts task base URL path prefixes and rejects query, fragment or whitespace', () => {
    const key = 'TaskPublicAddress'
    expect(prepareOptionChanges(settingsSections.site, { [key]: '' }, { [key]: 'https://example.test/gateway' }, new Set())).toEqual([
      { key, value: 'https://example.test/gateway' },
    ])
    for (const value of ['https://example.test?key=bad', 'https://example.test#', ' https://example.test', 'https://user:pass@example.test'])
      expect(() => prepareOptionChanges(settingsSections.site, { [key]: '' }, { [key]: value }, new Set())).toThrow('Invalid URL')
  })
})

describe('native system behavior settings', () => {
  it('preserves explicit false values when changing the native running modes', () => {
    const initial = { DefaultCollapseSidebar: 'false', DemoSiteEnabled: 'false', SelfUseModeEnabled: 'true' }
    expect(
      prepareOptionChanges(
        settingsSections.operations,
        initial,
        { ...initial, DefaultCollapseSidebar: 'true', SelfUseModeEnabled: 'false' },
        new Set()
      )
    ).toEqual([
      { key: 'DefaultCollapseSidebar', value: true },
      { key: 'SelfUseModeEnabled', value: false },
    ])
  })
})
