import type { CatalogModel, Offering } from '@/lib/api/types'

function protocolId(protocol: string) {
  return protocol === 'openai_video' ? 'openai-video' : protocol
}

function routeProtocols(offering: Offering) {
  const videoOnly =
    offering.pricing_ambiguous === false && ['table_video_count', 'table_video_seconds', 'video-route-a'].includes(offering.pricing_plugin_key || '')
  return offering.access.flatMap((access) => access.protocols.map(protocolId)).filter((protocol) => !videoOnly || protocol !== 'openai')
}

export function exampleRoute(model?: CatalogModel, offering?: Offering) {
  const routes = offering ? [offering] : model?.offerings || []
  return {
    routes,
    modelId: offering?.invocation_id || model?.configured_model_id || 'your-model',
    protocols: new Set(routes.flatMap(routeProtocols)),
  }
}

export const apiProtocols = [
  { id: 'openai', label: 'Chat Completions', path: '/v1/chat/completions', stream: true },
  { id: 'openai-response', label: 'Responses', path: '/v1/responses', stream: true },
  { id: 'openai-response-compact', label: 'Responses compact', path: '/v1/responses/compact', stream: false },
  { id: 'deepseek-tools-search', label: 'DeepSeek Search', path: '/v1/tools/search', stream: false },
  { id: 'deepseek-tools-fetch', label: 'DeepSeek Fetch', path: '/v1/tools/fetch', stream: false },
  { id: 'anthropic', label: 'Anthropic Messages', path: '/v1/messages', stream: true },
  { id: 'gemini', label: 'Gemini GenerateContent', path: '/v1beta/models/{model}:generateContent', stream: true },
  { id: 'image-generation', label: 'Image generation', path: '/v1/images/generations', stream: false },
  { id: 'openai-video', label: 'Video generation', path: '/v1/videos', stream: false },
  { id: 'embeddings', label: 'Embeddings', path: '/v1/embeddings', stream: false },
  { id: 'jina-rerank', label: 'Rerank', path: '/v1/rerank', stream: false },
] as const
// Paths whose full request format is upstream-specific; do not invent a payload.
export const endpointOnlyProtocols = [{ id: 'openai-alpha-search', label: 'OpenAI Alpha Search', path: '/v1/alpha/search' }] as const
export type ApiProtocol = (typeof apiProtocols)[number]['id']
export type ExampleLanguage = 'curl' | 'powershell' | 'python' | 'javascript'

/** Return request endpoints advertised by the selected route. */
export function routeEndpoints(offering: Offering, address: string, fallbackModel: string) {
  const supported = new Set(routeProtocols(offering))
  const model = offering.invocation_id || fallbackModel
  return [...apiProtocols, ...endpointOnlyProtocols]
    .filter((protocol) => supported.has(protocol.id))
    .map((protocol) => ({
      id: protocol.id,
      label: protocol.label,
      url: `${address}${protocol.path.replace('{model}', encodeURIComponent(model))}`,
    }))
}

export function gatewayAddress(configured: string | undefined, browserOrigin: string) {
  const value = configured || browserOrigin
  if (!value) return ''
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid URL')
  return url.toString().replace(/\/+$/, '')
}

/** Examples use a placeholder credential and are never executed by the page. */
export function apiExample(protocol: ApiProtocol, address: string, model: string, stream: boolean, language: ExampleLanguage, offering?: Offering) {
  const definition = apiProtocols.find((item) => item.id === protocol)!
  let path: string = definition.path
  const streaming = stream && definition.stream
  // This public model's adapter requires JSON reference_images, not input_reference.
  const klingReference = protocol === 'openai-video' && model === 'kling-omni-4-0-second-line-a'
  if (protocol === 'openai-video' && !klingReference) {
    const url = `${gatewayAddress(address, '')}${path}`
    const prompt = 'A quiet mountain lake at sunrise'
    const isTongxin = offering?.pricing_ambiguous === false && offering.pricing_plugin_key === 'video-route-a'
    let seconds: string | undefined
    if (isTongxin) seconds = model === 'seedance-2-5' ? '15' : '5'
    else if (offering?.pricing_ambiguous === false && ['table_video_count', 'table_video_seconds'].includes(offering.pricing_plugin_key || ''))
      seconds = '5'
    const image = isTongxin && model === 'seedance-2-5' ? 'https://example.com/reference.png' : undefined
    const imageField = isTongxin && model === 'seedance-2.0-mini-i2v' ? 'image' : 'input_reference'
    const reference = image || (isTongxin && model.startsWith('seedance-2.0-mini-') ? 'https://example.com/reference.png' : undefined)
    if (language === 'javascript')
      return `const form = new FormData();\nform.append('model', ${JSON.stringify(model)});\nform.append('prompt', ${JSON.stringify(prompt)});${seconds ? `\nform.append('seconds', '${seconds}');` : ''}${reference ? `\nform.append('${imageField}', ${JSON.stringify(reference)});` : ''}\nconst response = await fetch(${JSON.stringify(url)}, {\n  method: 'POST',\n  headers: { Authorization: \`Bearer \${process.env.NEW_API_KEY}\` },\n  body: form,\n});\nif (!response.ok) throw new Error(await response.text());\nconsole.log(await response.json());`
    if (language === 'python')
      return `import json, os, urllib.request, uuid\n\nfields = json.loads(${JSON.stringify(JSON.stringify({ model, prompt, ...(seconds ? { seconds } : {}), ...(reference ? { [imageField]: reference } : {}) }))})\nboundary = 'eva-' + uuid.uuid4().hex\nbody = b''.join(\n    (f'--{boundary}\\r\\nContent-Disposition: form-data; name="{name}"\\r\\n\\r\\n{value}\\r\\n').encode('utf-8')\n    for name, value in fields.items()\n) + f'--{boundary}--\\r\\n'.encode('utf-8')\nrequest = urllib.request.Request(${JSON.stringify(url)}, data=body, headers={\n    'Authorization': 'Bearer ' + os.environ['NEW_API_KEY'],\n    'Content-Type': 'multipart/form-data; boundary=' + boundary,\n}, method='POST')\nwith urllib.request.urlopen(request) as response:\n    print(json.load(response))`
    if (language === 'powershell') {
      const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
      return (
        `curl.exe ${quote(url)} \`\n  -H "Authorization: Bearer $env:NEW_API_KEY" \`\n  --form-string ${quote(`model=${model}`)} \`\n  --form-string ${quote(`prompt=${prompt}`)}` +
        (seconds ? ` \`\n  --form-string ${quote(`seconds=${seconds}`)}` : '') +
        (reference ? ` \`\n  --form-string ${quote(`${imageField}=${reference}`)}` : '')
      )
    }
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
    return (
      `curl ${quote(url)} \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  --form-string ${quote(`model=${model}`)} \\\n  --form-string ${quote(`prompt=${prompt}`)}` +
      (seconds ? ` \\\n  --form-string ${quote(`seconds=${seconds}`)}` : '') +
      (reference ? ` \\\n  --form-string ${quote(`${imageField}=${reference}`)}` : '')
    )
  }
  const body: Record<string, unknown> = klingReference
    ? {
        model,
        prompt: 'Animate the reference image with gentle natural motion. Keep the scene and camera stable.',
        seconds: 5,
        resolution: '720p',
        reference_images: ['https://example.com/reference.jpg'],
      }
    : protocol === 'anthropic'
      ? { model, max_tokens: 1024, messages: [{ role: 'user', content: 'Hello!' }] }
      : protocol === 'openai-response' || protocol === 'openai-response-compact'
        ? { model, input: 'Hello!' }
        : protocol === 'deepseek-tools-search'
          ? { query: 'API gateway' }
          : protocol === 'deepseek-tools-fetch'
            ? { url: 'https://example.com/' }
            : protocol === 'gemini'
              ? { contents: [{ role: 'user', parts: [{ text: 'Hello!' }] }] }
              : protocol === 'image-generation'
                ? { model, prompt: 'A quiet mountain lake at sunrise' }
                : protocol === 'embeddings'
                  ? { model, input: 'Hello!' }
                  : protocol === 'jina-rerank'
                    ? { model, query: 'API gateway', documents: ['A unified gateway for model APIs.', 'A recipe for bread.'] }
                    : { model, messages: [{ role: 'user', content: 'Hello!' }] }
  if (protocol === 'gemini') path = `/v1beta/models/${encodeURIComponent(model)}:${streaming ? 'streamGenerateContent?alt=sse' : 'generateContent'}`
  else if (definition.stream) body.stream = streaming
  const url = `${gatewayAddress(address, '')}${path}`
  const headers =
    protocol === 'anthropic' ? { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' } : { 'Content-Type': 'application/json' }
  const payload = JSON.stringify(body, null, 2)
  if (language === 'javascript')
    return `const response = await fetch(${JSON.stringify(url)}, {\n  method: 'POST',\n  headers: {\n    ...${JSON.stringify(headers)},\n    Authorization: \`Bearer \${process.env.NEW_API_KEY}\`,\n  },\n  body: JSON.stringify(${payload}),\n});\nif (!response.ok) throw new Error(await response.text());\n${streaming ? 'for await (const chunk of response.body) process.stdout.write(chunk);' : 'console.log(await response.json());'}`
  if (language === 'python')
    return `import json, os, urllib.request\n\npayload = json.loads(${JSON.stringify(JSON.stringify(body))})\nheaders = json.loads(${JSON.stringify(JSON.stringify(headers))})\nheaders['Authorization'] = 'Bearer ' + os.environ['NEW_API_KEY']\nrequest = urllib.request.Request(${JSON.stringify(url)}, data=json.dumps(payload).encode(), headers=headers, method='POST')\nwith urllib.request.urlopen(request) as response:\n${streaming ? '    for line in response:\n        print(line.decode(), end="")' : '    print(json.load(response))'}`
  if (language === 'powershell') {
    const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
    return `${quote(payload)} | curl.exe${streaming ? ' --no-buffer' : ''} ${quote(url)} \`\n  -H "Authorization: Bearer $env:NEW_API_KEY" \`\n${Object.entries(
      headers
    )
      .map(([key, value]) => `  -H ${quote(`${key}: ${value}`)} \`\n`)
      .join('')}  --data-binary '@-'`
  }
  const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  return `curl${streaming ? ' --no-buffer' : ''} ${shellQuote(url)} \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n${Object.entries(headers)
    .map(([key, value]) => `  -H ${shellQuote(`${key}: ${value}`)} \\\n`)
    .join('')}  -d ${shellQuote(payload)}`
}
