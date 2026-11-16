import { docsCatalog, publishedDocsToEntries, searchDocs } from './docs-catalog'
import { guides, toolGuides } from './guides'
import { describe, expect, it } from 'vitest'
import { apiExample, exampleRoute, gatewayAddress, routeEndpoints } from './api-examples'
import type { Offering } from '@/lib/api/types'
import chinese from '@/i18n/zh.json'
import {
  operationParameters,
  requestMedia,
  responseMedia,
  schemaExample,
  schemaFields,
  resolveReference,
  restRequestDraft,
  restCodeExample,
  type RestParameter,
} from '../developer/openapi-reference'
import type { RestOperation } from '../developer/types'

describe('gateway-owned request examples', () => {
  it.each(['curl', 'powershell', 'python', 'javascript'] as const)('includes required Kling references in the %s JSON example', (language) => {
    const code = apiExample('openai-video', 'https://gateway.test', 'kling-omni-4-0-second-line-a', false, language)
    expect(code).toContain('https://gateway.test/v1/videos')
    expect(code).toContain('application/json')
    expect(code).toContain('reference_images')
    expect(code).toContain('https://example.com/reference.jpg')
    expect(code).toContain('720p')
    expect(code).toContain('seconds')
    expect(code).toContain('NEW_API_KEY')
    expect(code).not.toContain('input_reference')
    expect(code).not.toContain('9yapi')
  })
  it('documents direct text and image requests and their example responses', () => {
    const sections = guides.api.sections
    expect(sections.find((section) => section.title === 'Text generation')?.code).toContain('/v1/chat/completions')
    expect(sections.find((section) => section.title === 'Text response')?.code).toContain('"choices"')
    expect(sections.find((section) => section.title === 'Image generation')?.code).toContain('/v1/images/generations')
    expect(sections.find((section) => section.title === 'Image response')?.code).toContain('"data"')
  })
  it('lists only supported endpoints for the selected route and encodes its invocation ID', () => {
    const route = {
      offering_key: 'route-1',
      name: 'vip',
      invocation_id: 'folder/model',
      public_description: '',
      availability: 'available',
      prices: [],
      metrics: [],
      access: [{ protocols: ['anthropic', 'gemini', 'unknown', 'anthropic'] }],
    } satisfies Offering
    expect(routeEndpoints(route, 'https://gateway.test', 'fallback')).toEqual([
      { id: 'anthropic', label: 'Anthropic Messages', url: 'https://gateway.test/v1/messages' },
      { id: 'gemini', label: 'Gemini GenerateContent', url: 'https://gateway.test/v1beta/models/folder%2Fmodel:generateContent' },
    ])
    expect(routeEndpoints({ ...route, access: [] }, 'https://gateway.test', 'fallback')).toEqual([])
    expect(routeEndpoints({ ...route, access: [{ protocols: ['openai-alpha-search'] }] }, 'https://gateway.test', 'fallback')).toEqual([
      { id: 'openai-alpha-search', label: 'OpenAI Alpha Search', url: 'https://gateway.test/v1/alpha/search' },
    ])
  })
  it('uses the configured gateway and keeps secrets as environment references', () => {
    const code = apiExample('openai', 'https://gateway.test/', 'model-name', true, 'curl')
    expect(code).toContain("'https://gateway.test/v1/chat/completions'")
    expect(code).toContain('$NEW_API_KEY')
    expect(code).toContain('--no-buffer')
    expect(code).toContain('"stream": true')
  })
  it('keeps apostrophes inside shell-quoted model data', () => {
    expect(apiExample('openai', 'https://gateway.test', "model'$(command)", false, 'curl')).toContain("model'\\''$(command)")
  })
  it('generates PowerShell 7 commands with a literal JSON body and environment key', () => {
    const code = apiExample('anthropic', 'https://gateway.test', "model'$(command)", true, 'powershell')
    expect(code).toContain("model''$(command)")
    expect(code).toContain('curl.exe --no-buffer')
    expect(code).toContain('$env:NEW_API_KEY')
    expect(code).toContain('anthropic-version: 2023-06-01')
    expect(code).toContain("--data-binary '@-'")
    const video = apiExample('openai-video', 'https://gateway.test', "movie'one", false, 'powershell')
    expect(video).toContain("--form-string 'model=movie''one'")
  })
  it('uses Gemini path parameters and streaming protocol rather than an OpenAI payload', () => {
    const code = apiExample('gemini', 'https://gateway.test', 'folder/model', true, 'curl')
    expect(code).toContain('/v1beta/models/folder%2Fmodel:streamGenerateContent?alt=sse')
    expect(code).toContain('"contents"')
    expect(code).not.toContain('"stream"')
  })
  it('uses native compact and DeepSeek tool request shapes', () => {
    const compact = apiExample('openai-response-compact', 'https://gateway.test', 'model-a', true, 'curl')
    expect(compact).toContain('/v1/responses/compact')
    expect(compact).toContain('"model": "model-a"')
    expect(compact).toContain('"input": "Hello!"')
    expect(compact).not.toContain('"stream"')
    const search = apiExample('deepseek-tools-search', 'https://gateway.test', 'routing-only', true, 'javascript')
    expect(search).toContain('/v1/tools/search')
    expect(search).toContain('"query": "API gateway"')
    expect(search).not.toContain('routing-only')
    const fetch = apiExample('deepseek-tools-fetch', 'https://gateway.test', 'routing-only', false, 'python')
    expect(fetch).toContain('/v1/tools/fetch')
    expect(fetch).toContain('https://example.com/')
    expect(fetch).not.toContain('routing-only')
  })
  it('does not add streaming to embedding and image requests', () => {
    for (const protocol of ['embeddings', 'image-generation'] as const)
      expect(apiExample(protocol, 'https://gateway.test', 'model', true, 'curl')).not.toContain('--no-buffer')
  })
  it('generates multipart video creation examples for the selected model and route', () => {
    const route = {
      offering_key: 'video',
      name: 'vip',
      invocation_id: "movie'one",
      public_description: '',
      availability: 'available',
      prices: [],
      metrics: [],
      access: [{ protocols: ['openai-video'] }],
    } satisfies Offering
    expect(routeEndpoints(route, 'https://gateway.test', 'fallback')).toEqual([
      { id: 'openai-video', label: 'Video generation', url: 'https://gateway.test/v1/videos' },
    ])
    const curl = apiExample('openai-video', 'https://gateway.test', route.invocation_id, true, 'curl')
    expect(curl).toContain("--form-string 'model=movie'\\''one'")
    expect(curl).not.toContain('--no-buffer')
    const node = apiExample('openai-video', 'https://gateway.test', route.invocation_id, false, 'javascript')
    expect(() => new Function(`return (async()=>{${node}})`)).not.toThrow()
    expect(node).toContain("form.append('model', \"movie'one\")")
    const python = apiExample('openai-video', 'https://gateway.test', route.invocation_id, false, 'python')
    expect(python).toContain('multipart/form-data; boundary=')
    expect(python).toContain('https://gateway.test/v1/videos')
    for (const code of [curl, node, python]) expect(code).toContain('NEW_API_KEY')
  })
  it('recognizes the actual gateway openai_video protocol without duplicate options', () => {
    const route = {
      offering_key: 'video',
      name: 'route',
      invocation_id: 'multi-model',
      public_description: '',
      availability: 'available',
      pricing_plugin_key: 'multi_protocol_provider',
      prices: [],
      metrics: [],
      access: [{ protocols: ['openai', 'openai_video', 'openai-video'] }],
    } satisfies Offering
    expect([...exampleRoute(undefined, route).protocols]).toEqual(['openai', 'openai-video'])
    expect(routeEndpoints(route, 'https://gateway.test', 'fallback')).toEqual([
      { id: 'openai', label: 'Chat Completions', url: 'https://gateway.test/v1/chat/completions' },
      { id: 'openai-video', label: 'Video generation', url: 'https://gateway.test/v1/videos' },
    ])
  })
  it('hides Chat Completions only for unambiguously bound table video placeholders', () => {
    const base = {
      offering_key: 'video',
      name: 'route',
      invocation_id: 'table-seedance-2-5',
      public_description: '',
      availability: 'available',
      prices: [],
      metrics: [],
      access: [{ protocols: ['openai', 'openai_video'] }],
    } satisfies Offering
    for (const key of ['table_video_count', 'table_video_seconds']) {
      const route = { ...base, pricing_plugin_key: key, pricing_ambiguous: false }
      expect([...exampleRoute(undefined, route).protocols]).toEqual(['openai-video'])
      expect(routeEndpoints(route, 'https://gateway.test', 'fallback')).toEqual([
        { id: 'openai-video', label: 'Video generation', url: 'https://gateway.test/v1/videos' },
      ])
      expect(apiExample('openai-video', 'https://gateway.test', route.invocation_id, false, 'curl', route)).toContain("--form-string 'seconds=5'")
      expect([...exampleRoute(undefined, { ...route, pricing_ambiguous: true }).protocols]).toEqual(['openai', 'openai-video'])
      expect([...exampleRoute(undefined, { ...base, pricing_plugin_key: key }).protocols]).toEqual(['openai', 'openai-video'])
    }
    expect([...exampleRoute(undefined, { ...base, pricing_plugin_key: 'other_provider' }).protocols]).toEqual(['openai', 'openai-video'])
    expect([...exampleRoute(undefined, base).protocols]).toEqual(['openai', 'openai-video'])
  })
  it('documents A route as video and includes the required Seedance 2.5 image', () => {
    const route = {
      offering_key: 'video',
      name: 'A路线',
      invocation_id: 'seedance-2-5',
      public_description: '',
      availability: 'available',
      prices: [],
      metrics: [],
      access: [{ protocols: ['openai', 'openai_video'] }],
      pricing_plugin_key: 'video-route-a',
      pricing_ambiguous: false,
    } satisfies Offering
    expect([...exampleRoute(undefined, route).protocols]).toEqual(['openai-video'])
    for (const language of ['curl', 'powershell', 'python', 'javascript'] as const) {
      const example = apiExample('openai-video', 'https://gateway.test', route.invocation_id, false, language, route)
      expect(example).toContain('15')
      expect(example).toContain('input_reference')
    }
  })
  it('adds a duration only for a selected table video plugin', () => {
    const base = {
      offering_key: 'video',
      name: 'route',
      invocation_id: 'table-seedance-2-5',
      public_description: '',
      availability: 'available',
      prices: [],
      metrics: [],
      access: [{ protocols: ['openai-video'] }],
    } satisfies Offering
    for (const key of ['table_video_seconds', 'table_video_count']) {
      const route = { ...base, pricing_plugin_key: key, pricing_ambiguous: false }
      expect(apiExample('openai-video', 'https://gateway.test', route.invocation_id, false, 'curl', route)).toContain("--form-string 'seconds=5'")
      expect(apiExample('openai-video', 'https://gateway.test', route.invocation_id, false, 'powershell', route)).toContain(
        "--form-string 'seconds=5'"
      )
      const node = apiExample('openai-video', 'https://gateway.test', route.invocation_id, false, 'javascript', route)
      expect(node).toContain("form.append('seconds', '5')")
      expect(() => new Function(`return (async()=>{${node}})`)).not.toThrow()
      expect(apiExample('openai-video', 'https://gateway.test', route.invocation_id, false, 'python', route)).toContain('seconds')
    }
    for (const language of ['curl', 'powershell', 'python', 'javascript'] as const) {
      expect(
        apiExample('openai-video', 'https://gateway.test', base.invocation_id, false, language, { ...base, pricing_plugin_key: 'different_provider' })
      ).not.toContain('seconds')
      expect(apiExample('openai-video', 'https://gateway.test', base.invocation_id, false, language)).not.toContain('seconds')
      expect(
        apiExample('openai-video', 'https://gateway.test', base.invocation_id, false, language, {
          ...base,
          pricing_plugin_key: 'table_video_count',
          pricing_ambiguous: true,
        })
      ).not.toContain('seconds')
    }
  })
  it('includes native Anthropic headers and required output limits', () => {
    const code = apiExample('anthropic', 'https://gateway.test', 'claude-model', false, 'curl')
    expect(code).toContain('anthropic-version: 2023-06-01')
    expect(code).toContain('"max_tokens": 1024')
  })
  it('generates Node and Python examples with matching gateway endpoints', () => {
    const node = apiExample('openai-response', 'https://gateway.test', 'model', true, 'javascript')
    expect(() => new Function(`return (async () => {\n${node}\n})`)).not.toThrow()
    expect(node).toContain('for await (const chunk of response.body)')
    expect(apiExample('jina-rerank', 'https://gateway.test', 'model', false, 'python')).toContain('https://gateway.test/v1/rerank')
  })
  it('rejects credentials, fragments and non-HTTP base URLs', () => {
    for (const url of ['javascript:alert(1)', 'https://user:password@gateway.test', 'https://gateway.test/#key', 'https://gateway.test/?key=secret'])
      expect(() => gatewayAddress(url, '')).toThrow()
    expect(gatewayAddress(undefined, 'https://gateway.test/')).toBe('https://gateway.test')
  })
})

const restOperation: RestOperation = {
  id: 1,
  rest_api_id: 1,
  method: 'POST',
  path: '/jobs/{id}',
  operation_id: 'createJob',
  summary: '',
  description: '',
  enabled: true,
  quota: 125,
  definition: {},
}
const parameter = (name: string, location: string, schema: Record<string, unknown>, extra: Partial<RestParameter> = {}): RestParameter => ({
  name,
  in: location,
  schema,
  required: false,
  description: '',
  style: location === 'path' ? 'simple' : 'form',
  explode: location !== 'path',
  collectionFormat: '',
  ...extra,
})

describe('REST documentation and editable examples', () => {
  it('resolves escaped local references, keeps siblings and terminates cycles without remote reads', () => {
    const root = { components: { schemas: { 'a/b': { type: 'string', description: 'base' }, cycle: { $ref: '#/components/schemas/cycle' } } } }
    expect(resolveReference({ $ref: '#/components/schemas/a~1b', description: 'override' }, root)).toEqual({
      type: 'string',
      description: 'override',
    })
    expect(resolveReference({ $ref: '#/components/schemas/cycle' }, root).$ref).toBe('#/components/schemas/cycle')
    expect(resolveReference({ $ref: '#/toString' }, {}).$ref).toBe('#/toString')
    expect(resolveReference({ $ref: 'https://external.test/schema' }, root).$ref).toBe('https://external.test/schema')
  })
  it('preserves explicit false, zero and null examples and respects request/response visibility', () => {
    const schema = {
      type: 'object',
      properties: {
        flag: { type: 'boolean', example: false },
        count: { type: 'integer', default: 0 },
        empty: { example: null },
        id: { type: 'integer', readOnly: true },
        password: { type: 'string', writeOnly: true },
      },
    }
    expect(schemaExample(schema, {})).toEqual({ flag: false, count: 0, empty: null, password: 'string' })
    expect(schemaExample(schema, {}, 0, 'response')).toEqual({ flag: false, count: 0, empty: null, id: 0 })
  })
  it('renders referenced array fields once, including required child properties', () => {
    const root = { definitions: { Item: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } } }
    const fields = schemaFields({ type: 'object', properties: { items: { type: 'array', items: { $ref: '#/definitions/Item' } } } }, root)
    expect(fields.map((field) => field.name)).toEqual(['items', 'items[].id'])
    expect(fields[1].required).toBe(true)
  })
  it('reads OpenAPI 3 parameter/body/response references and example objects', () => {
    const root = {
      components: {
        parameters: { ID: { name: 'id', in: 'path', schema: { type: 'string' }, example: 'item-1' } },
        schemas: { Job: { type: 'object', properties: { name: { type: 'string', example: 'eva' } } } },
      },
    }
    const operation = {
      ...restOperation,
      definition: {
        parameters: [{ $ref: '#/components/parameters/ID' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Job' }, examples: { sample: { value: { name: 'provided' } } } } },
        },
        responses: { '200': { description: 'Accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Job' } } } } },
      },
    }
    const params = operationParameters(operation, root)
    expect(params[0]).toMatchObject({ required: true, style: 'simple', explode: false, schema: { example: 'item-1' } })
    expect(requestMedia(operation, root)[0]).toMatchObject({ type: 'application/json', required: true, example: { name: 'provided' } })
    expect(responseMedia(operation, root)[0]).toMatchObject({ status: '200', media: [{ example: { name: 'eva' } }] })
  })
  it('reads Swagger 2 body and response schemas', () => {
    const operation = {
      ...restOperation,
      definition: {
        parameters: [{ name: 'body', in: 'body', schema: { type: 'boolean', default: false } }],
        responses: { '200': { description: 'OK', schema: { type: 'integer', example: 0 } } },
      },
    }
    expect(requestMedia(operation, {})[0].example).toBe(false)
    expect(responseMedia(operation, {})[0].media[0].example).toBe(0)
  })
  it('encodes path and query values, repeated arrays, deep objects and explicit false/zero', () => {
    const params = [
      parameter('id', 'path', { type: 'string' }, { required: true }),
      parameter('tags', 'query', { type: 'array' }),
      parameter('filter', 'query', { type: 'object' }, { style: 'deepObject' }),
      parameter('active', 'query', { type: 'boolean' }),
      parameter('limit', 'query', { type: 'integer' }),
    ]
    const request = restRequestDraft(
      'https://eva.test/',
      'demo',
      restOperation,
      params,
      { 'path:id': '中文 + #', 'query:tags': '["a&b","c"]', 'query:filter': '{"q":"a=b"}', 'query:active': 'false', 'query:limit': '0' },
      'application/json',
      '{"id":9007199254740993}'
    )
    const url = new URL(request.url)
    expect(url.pathname).toBe('/v1/rest/demo/jobs/%E4%B8%AD%E6%96%87%20%2B%20%23')
    expect(url.searchParams.getAll('tags')).toEqual(['a&b', 'c'])
    expect(url.searchParams.get('filter[q]')).toBe('a=b')
    expect(url.searchParams.get('active')).toBe('false')
    expect(url.searchParams.get('limit')).toBe('0')
    expect(request.body).toBe('{"id":9007199254740993}')
    expect(request.issues).toEqual([])
  })
  it('applies matrix/label path styles and Swagger CSV arrays', () => {
    const op = { ...restOperation, path: '/jobs/{id}/{color}' }
    const params = [
      parameter('id', 'path', { type: 'array' }, { style: 'matrix', explode: true }),
      parameter('color', 'path', { type: 'object' }, { style: 'label', explode: true }),
      parameter('tags', 'query', { type: 'array' }, { collectionFormat: 'csv' }),
    ]
    const request = restRequestDraft(
      'https://eva.test',
      'demo',
      op,
      params,
      { 'path:id': '[1,2]', 'path:color': '{"R":100,"G":200}', 'query:tags': '["a","b"]' },
      '',
      ''
    )
    expect(request.url).toContain('/jobs/;id=1;id=2/.R=100.G=200?tags=a%2Cb')
  })
  it('reports required/type/JSON errors while keeping gateway credentials out of parameter headers', () => {
    const params = [
      parameter('id', 'path', { type: 'string' }, { required: true }),
      parameter('count', 'query', { type: 'integer' }),
      parameter('Authorization', 'header', { type: 'string' }, { required: true }),
      parameter('session', 'cookie', { type: 'string' }),
    ]
    const request = restRequestDraft(
      'https://eva.test',
      'demo',
      restOperation,
      params,
      { 'query:count': '1.5', 'header:Authorization': 'secret', 'cookie:session': 'secret' },
      'application/json',
      '{'
    )
    expect(request.issues).toEqual(['id: Required parameter', 'count: Parameter value does not match its type', 'Invalid JSON request body'])
    expect(JSON.stringify(request)).not.toContain('secret')
  })
  it('generates matching curl/Node/Python requests with safe literals and no body on GET', () => {
    const request = restRequestDraft('https://eva.test', 'demo', restOperation, [], {}, 'application/json', `{"name":"a'$(command)","flag":false}`)
    const curl = restCodeExample(request, 'curl'),
      node = restCodeExample(request, 'javascript'),
      python = restCodeExample(request, 'python')
    expect(curl).toContain("a'\\''$(command)")
    expect(curl).toContain('$NEW_API_KEY')
    expect(() => new Function(`return (async()=>{${node}})`)).not.toThrow()
    expect(python).toContain("os.environ['NEW_API_KEY']")
    expect(python).toContain(".encode('utf-8')")
    expect(restRequestDraft('https://eva.test', 'demo', { ...restOperation, method: 'GET' }, [], {}, 'application/json', '{}').body).toBeUndefined()
  })
  it('encodes form bodies and emits multipart boundaries through each language client', () => {
    const encoded = restRequestDraft('https://eva.test', 'demo', restOperation, [], {}, 'application/x-www-form-urlencoded', '{"tags":["a&b","c"]}')
    expect(restCodeExample(encoded, 'curl')).toContain('tags=a%26b&tags=c')
    const multipart = restRequestDraft('https://eva.test', 'demo', restOperation, [], {}, 'multipart/form-data', '{"name":"eva"}')
    expect(restCodeExample(multipart, 'curl')).toContain("--form-string 'name=eva'")
    const node = restCodeExample(multipart, 'javascript')
    expect(node).toContain('new FormData()')
    expect(node).not.toContain('Content-Type')
    expect(restCodeExample(multipart, 'python')).toContain('files=')
  })
})

describe('help center documentation search', () => {
  it('covers request, missing endpoint and service errors in troubleshooting', () => {
    const errors = guides.errors.sections
    expect(errors.map((section) => section.title)).toEqual(expect.arrayContaining(['400', '401', '403', '404', '429', '5xx']))
    expect(errors.find((section) => section.title === '404')?.link?.href).toBe('/docs/async-tasks')
    expect(errors.find((section) => section.title === '5xx')?.text).toContain('before submitting again')
  })
  it('provides a first model request after model discovery in the quick start', () => {
    const sections = guides['getting-started'].sections
    expect(sections.find((section) => section.title === 'Models')?.code).toContain('/v1/models')
    const request = sections.find((section) => section.title === 'Send a request')?.code || ''
    expect(request).toContain('/v1/responses')
    expect(request).toContain('"model":"your-model"')
    expect(request).toContain('$NEW_API_KEY')
    expect(sections.find((section) => section.title === 'Choose a model')?.link?.href).toBe('/pricing')
    expect(sections.find((section) => section.title === 'Create API key')?.link?.href).toBe('/keys')
    expect(sections.find((section) => section.title === 'View usage')?.link?.href).toBe('/usage-logs/common')
    for (const slug of ['cc-switch', 'codex-cli', 'claude-code', 'deepseek-harness', 'workbuddy', 'cc-switch-aggregation']) {
      expect(sections.some((section) => section.link?.href === `/docs/${slug}`)).toBe(true)
    }
  })
  it('finds published documents by title and summary and links to their encoded slug', () => {
    const entries = publishedDocsToEntries([
      { id: 42, slug: 'custom guide', title: '模型接入', summary: '专用线路使用说明', language: 'zh', source_type: 'markdown', external_url: '' },
    ])
    expect(searchDocs('专用线路', (key) => key, entries)).toEqual(entries)
    expect(searchDocs('模型接入', (key) => key, entries)[0]?.href).toBe('/docs/published/custom%20guide')
    expect(searchDocs('未发布', (key) => key, entries)).toEqual([])
  })
  it('matches translated topics and retains source protocol names', () => {
    const translate = (key: string) => (key === 'Connect asynchronous tasks' ? '接入异步任务' : key)
    expect(searchDocs('异步', translate).map((entry) => entry.id)).toContain('async-tasks')
    expect(searchDocs('background Responses', translate).map((entry) => entry.id)).toContain('async-tasks')
    expect(searchDocs('an impossible phrase', translate)).toEqual([])
  })
  it('includes the dedicated route selection guide in search', () => {
    expect(searchDocs('latency output speed', (key) => key).map((entry) => entry.href)).toContain('/docs/choose-route')
    expect(guides['choose-route'].sections.map((section) => section.title)).toEqual(['Choose a route', 'Performance', 'Price', 'API keys'])
    expect(guides['choose-route'].sections.find((section) => section.title === 'Choose a route')?.link?.href).toBe('/pricing')
    expect(guides['choose-route'].sections.find((section) => section.title === 'API keys')?.link?.href).toBe('/keys')
  })
  it('lists model selection and key guides with links to the relevant pages', () => {
    expect(docsCatalog.find((entry) => entry.id === 'choose-model')?.href).toBe('/docs/choose-model')
    expect(guides['api-keys'].sections.find((section) => section.title === 'Create API key')?.link?.href).toBe('/keys')
    expect(guides['quick-create-api-key'].sections.find((section) => section.title === 'Choose a model')?.link?.href).toBe('/pricing')
    expect(guides['getting-started'].sections.find((section) => section.title === 'Create an account')?.link?.href).toBe('/sign-up')
    expect(guides['getting-started'].sections.find((section) => section.title === 'Available balance')?.link?.href).toBe('/wallet')
    expect(guides['getting-started'].sections.find((section) => section.title === 'Playground')?.link?.href).toBe('/playground')
    expect(guides['getting-started'].sections.find((section) => section.title === 'Attachments')?.text).toContain('sent to the model provider')
  })
  it('provides PowerShell commands with the Windows environment variable syntax', () => {
    const example = guides['getting-started'].sections.find((section) => section.title === 'PowerShell 7')?.code || ''
    expect(example).toContain('$env:NEW_API_KEY')
    expect(example).toContain('{{origin}}/v1/models')
    expect(example).toContain('{{origin}}/v1/responses')
    expect(example).toContain('ConvertTo-Json -Compress')
  })
  it('includes Cursor gateway settings and credential handling in client guidance', () => {
    expect(toolGuides.cursor.sections.find((section) => section.title === 'Connection settings')?.code).toContain('{{origin}}/v1')
    expect(toolGuides.cursor.sections.find((section) => section.title === 'Security')?.text).toContain('Cursor routes requests through its servers')
    expect(searchDocs('Cursor', (key) => key).map((entry) => entry.id)).toContain('cursor')
  })
  it('finds translated words from guide sections while retaining English search', () => {
    const translations: Record<string, string> = chinese
    const translate = (key: string) => translations[key] || key
    expect(searchDocs('样本量', translate).map((entry) => entry.id)).toContain('choose-route')
    expect(searchDocs('sample size', translate).map((entry) => entry.id)).toContain('choose-route')
  })
  it('returns the full catalog for whitespace and avoids duplicate client aliases', () => {
    expect(searchDocs('  ', (key) => key)).toEqual(docsCatalog)
    expect(docsCatalog.filter((entry) => entry.title === 'Claude Code')).toHaveLength(1)
    expect(docsCatalog.filter((entry) => entry.title === 'Codex CLI')).toHaveLength(1)
    expect(docsCatalog.find((entry) => entry.id === 'getting-started')?.href).toBe('/docs/getting-started')
  })
  it('keeps asynchronous examples on gateway-owned routes and placeholder credentials', () => {
    const examples = guides['async-tasks'].sections.map((section) => section.code || '').join('\n')
    expect(examples).toContain('{{origin}}/v1/responses')
    expect(examples).toContain('{{origin}}/v1/videos -H')
    expect(examples).toContain('-F "model=your-video-model"')
    expect(examples).toContain('{{origin}}/v1/videos/TASK_ID/content')
    expect(examples).toContain('$NEW_API_KEY')
    expect(examples).not.toContain('https://api.')
    const submit = guides['async-tasks'].sections.find((section) => section.title === 'Video generation')!
    expect(submit.code).not.toContain('/v1/responses')
    expect(submit.code).toContain('-F "seconds=5"')
    const status = guides['async-tasks'].sections.find((section) => section.title === 'Video result')!
    expect(status.code).not.toContain('/content')
  })
  it('documents the gateway video lifecycle with executable examples and route-dependent capabilities', () => {
    const video = guides['video-generation']
    const submit = video.sections.find((section) => section.title === 'Video generation')!
    const image = video.sections.find((section) => section.title === 'Attachments')!
    expect(submit.code).toContain('{{origin}}/v1/videos')
    expect(submit.code).toContain('"seconds":5')
    expect(submit.code).toContain('\n  -H "Authorization: Bearer $NEW_API_KEY"')
    expect(submit.code).not.toContain('\n+')
    expect(image.code).toContain('input_reference=@reference.png')
    expect(image.code).not.toContain('\n+')
    expect(video.sections.find((section) => section.title === 'Connection settings')?.text).toContain(
      'depend on each model and channel configuration'
    )
    expect(video.sections.find((section) => section.title === 'Errors')?.text).toContain('Do not blindly resubmit')
    expect(searchDocs('视频生成', (key) => (chinese as Record<string, string>)[key] || key).map((entry) => entry.href)).toContain(
      '/docs/video-generation'
    )
  })
  it('uses gateway addresses and client-specific settings for supported tool guides', () => {
    expect(toolGuides['claude-code'].sections[0].code).toContain('ANTHROPIC_BASE_URL={{origin}}')
    expect(toolGuides.workbuddy.sections[0].code).toContain('{{origin}}/v1/chat/completions')
    expect(toolGuides['deepseek-harness'].sections[0].code).toContain('Base URL: {{origin}}/v1')
    expect(toolGuides['deepseek-harness'].sections.find((section) => section.title === 'Search')?.text).toContain('own endpoint and credentials')
    expect(searchDocs('DeepSeek Harness', (key) => key).map((entry) => entry.href)).toContain('/docs/deepseek-harness')
    expect(toolGuides['cc-switch'].sections.find((section) => section.title === 'Security')?.text).toContain('contains your API key')
    expect(toolGuides['cc-switch'].sections.find((section) => section.title === 'Connection settings')?.text).toContain('may become active')
    expect(toolGuides['cc-switch-aggregation'].sections.find((section) => section.title === 'Models')?.text).toContain(
      'does not provide automatic failover'
    )
    expect(searchDocs('CC Switch aggregation', (key) => key).map((entry) => entry.href)).toContain('/docs/cc-switch-aggregation')
    expect(toolGuides.workbuddy.sections[0].text).toContain('custom protocol')
    expect(searchDocs('WorkBuddy', (key) => key).map((entry) => entry.href)).toContain('/docs/workbuddy')
    expect(toolGuides['claude-code'].sections[0].code).toContain('ANTHROPIC_AUTH_TOKEN=<your eva API key>')
    expect(toolGuides.cline.sections[0].code).toContain('Base URL: {{origin}}/v1')
    expect(toolGuides['open-webui'].sections[0].code).toContain('URL: {{origin}}/v1')
    expect(toolGuides['roo-code'].sections[0].code).toContain('Base URL: {{origin}}/v1')
    expect(toolGuides['cherry-studio'].sections[0].code).toContain('API Address: {{origin}}\n')
    expect(toolGuides['codex-cli'].sections[0].code).toContain('base_url = "{{origin}}/v1"')
    expect(toolGuides['codex-cli'].sections[0].code).toContain('env_key = "NEW_API_KEY"')
    expect(toolGuides['codex-cli'].sections[0].text).toContain('~/.codex/eva.config.toml')
    expect(toolGuides['codex-cli'].sections[2].code).toBe('codex --profile eva')
    expect(toolGuides.dify.sections[0].code).toContain('POST {{origin}}/v1/chat/completions')
    expect(toolGuides.n8n.sections[0].code).toContain('POST {{origin}}/v1/chat/completions')
    expect(toolGuides.langchain.sections[0].code).toContain('api_key=os.environ["EVA_API_KEY"]')
    expect(toolGuides['kilo-code'].sections[0].code).toContain('Base URL: {{origin}}/v1')
    expect(toolGuides.lobehub.sections[0].code).toContain('API Proxy URL: {{origin}}/v1')
    expect(searchDocs('Anthropic Messages', (key) => key).map((entry) => entry.id)).toContain('claude-code')
  })
})
