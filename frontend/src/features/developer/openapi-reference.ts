import type { RestOperation } from './types'
import type { ExampleLanguage } from '@/features/docs/api-examples'

export type JsonObject = Record<string, unknown>
export type RestParameter = {
  name: string
  in: string
  required: boolean
  description: string
  schema: JsonObject
  style: string
  explode: boolean
  collectionFormat: string
}
export type RestMedia = { type: string; schema: JsonObject; example: unknown; required: boolean }
export type SchemaField = { name: string; type: string; required: boolean; description: string }

export function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

/** Resolve only local JSON pointers; external references never trigger network requests. */
export function resolveReference(value: unknown, root: JsonObject, seen = new Set<string>()): JsonObject {
  const source = object(value),
    ref = source.$ref
  if (typeof ref !== 'string' || !ref.startsWith('#/') || seen.has(ref)) return source
  let target: unknown = root
  for (const key of ref
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    const record = object(target)
    if (!Object.hasOwn(record, key)) return source
    target = record[key]
  }
  const { $ref: _, ...siblings } = source
  return { ...resolveReference(target, root, new Set([...seen, ref])), ...siblings }
}

export function schemaExample(value: unknown, root: JsonObject, depth = 0, direction: 'request' | 'response' = 'request'): unknown {
  if (depth > 8) return undefined
  const schema = resolveReference(value, root)
  for (const key of ['example', 'default', 'const']) if (Object.hasOwn(schema, key)) return schema[key]
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0]
  if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0]
  for (const choice of ['oneOf', 'anyOf']) if (Array.isArray(schema[choice])) return schemaExample(schema[choice][0], root, depth + 1, direction)
  if (Array.isArray(schema.allOf)) {
    const examples = schema.allOf.map((item) => schemaExample(item, root, depth + 1, direction))
    const merged = Object.assign(Object.create(null), ...examples.filter((item) => item && typeof item === 'object' && !Array.isArray(item)))
    if (Object.keys(merged).length) return merged
  }
  if (schema.type === 'object' || schema.properties) {
    const result: JsonObject = Object.create(null)
    for (const [name, definition] of Object.entries(object(schema.properties))) {
      const field = resolveReference(definition, root)
      if ((direction === 'request' && field.readOnly) || (direction === 'response' && field.writeOnly)) continue
      const example = schemaExample(field, root, depth + 1, direction)
      if (example !== undefined) result[name] = example
    }
    return result
  }
  if (schema.type === 'array') return [schemaExample(schema.items, root, depth + 1, direction)].filter((item) => item !== undefined)
  if (schema.type === 'boolean') return false
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 0
  if (schema.type === 'null') return null
  if (schema.type === 'string') return schema.format === 'date' ? '2026-01-01' : 'string'
  return undefined
}

export function schemaFields(
  value: unknown,
  root: JsonObject,
  direction: 'request' | 'response' = 'request',
  prefix = '',
  depth = 0,
  ancestors = new Set<unknown>()
): SchemaField[] {
  if (depth > 8 || ancestors.has(value)) return []
  const schema = resolveReference(value, root),
    next = new Set([...ancestors, value])
  const required = Array.isArray(schema.required) ? schema.required : []
  const rows: SchemaField[] = []
  for (const [name, definition] of Object.entries(object(schema.properties))) {
    const field = resolveReference(definition, root)
    if ((direction === 'request' && field.readOnly) || (direction === 'response' && field.writeOnly)) continue
    const path = prefix ? `${prefix}.${name}` : name
    const type = Array.isArray(field.type) ? field.type.join(' | ') : String(field.type || (field.properties ? 'object' : field.$ref || '—'))
    rows.push({ name: path, type, required: required.includes(name), description: String(field.description || '') })
    rows.push(...schemaFields(field, root, direction, path, depth + 1, next))
  }
  for (const kind of ['allOf', 'oneOf', 'anyOf'])
    if (Array.isArray(schema[kind])) for (const part of schema[kind]) rows.push(...schemaFields(part, root, direction, prefix, depth + 1, next))
  if (schema.items) rows.push(...schemaFields(schema.items, root, direction, `${prefix}[]`, depth + 1, next))
  return rows
}

export function operationParameters(operation: RestOperation, root: JsonObject): RestParameter[] {
  if (!Array.isArray(operation.definition.parameters)) return []
  return operation.definition.parameters
    .map((value) => resolveReference(value, root))
    .filter((value) => typeof value.name === 'string' && value.in !== 'body')
    .map((value) => {
      const style = String(value.style || (value.in === 'path' || value.in === 'header' ? 'simple' : 'form'))
      return {
        name: String(value.name),
        in: String(value.in || 'query'),
        required: value.in === 'path' || value.required === true,
        description: String(value.description || ''),
        schema: { ...resolveReference(value.schema || value, root), ...(Object.hasOwn(value, 'example') ? { example: value.example } : {}) },
        style,
        explode: value.explode === undefined ? style === 'form' : !!value.explode,
        collectionFormat: String(value.collectionFormat || ''),
      }
    })
}

function mediaList(value: unknown, root: JsonObject, required: boolean, direction: 'request' | 'response'): RestMedia[] {
  return Object.entries(object(value)).map(([type, raw]) => {
    const media = resolveReference(raw, root),
      first = Object.values(object(media.examples))[0]
    const example = Object.hasOwn(media, 'example') ? media.example : resolveReference(first, root).value
    return {
      type,
      schema: resolveReference(media.schema, root),
      example: example === undefined ? schemaExample(media.schema, root, 0, direction) : example,
      required,
    }
  })
}

export function requestMedia(operation: RestOperation, root: JsonObject): RestMedia[] {
  const body = resolveReference(operation.definition.requestBody, root)
  if (body.content) return mediaList(body.content, root, !!body.required, 'request')
  const parameters = Array.isArray(operation.definition.parameters) ? operation.definition.parameters : []
  const legacy = parameters.map((value) => resolveReference(value, root)).find((value) => value.in === 'body')
  if (!legacy) return []
  const types = Array.isArray(operation.definition.consumes) ? operation.definition.consumes : ['application/json']
  return types.map((type) => ({
    type: String(type),
    schema: resolveReference(legacy.schema, root),
    example: schemaExample(legacy.schema, root),
    required: !!legacy.required,
  }))
}

export function responseMedia(operation: RestOperation, root: JsonObject) {
  return Object.entries(object(operation.definition.responses)).map(([status, value]) => {
    const response = resolveReference(value, root)
    let media = mediaList(response.content, root, false, 'response')
    if (!media.length && response.schema)
      media = [
        {
          type: 'application/json',
          schema: resolveReference(response.schema, root),
          example: Object.values(object(response.examples))[0] ?? schemaExample(response.schema, root, 0, 'response'),
          required: false,
        },
      ]
    return { status, description: String(response.description || ''), media }
  })
}

export function parameterInitialValue(parameter: RestParameter, root: JsonObject): string {
  const schema = parameter.schema
  const value = schema.example ?? schema.default ?? (parameter.required ? schemaExample(schema, root) : undefined)
  if (value === undefined) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function parameterValue(parameter: RestParameter, value: string): unknown {
  const type = parameter.schema.type
  if (type === 'array' || type === 'object') {
    const parsed: unknown = JSON.parse(value)
    if ((type === 'array' && !Array.isArray(parsed)) || (type === 'object' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))))
      throw new Error('Parameter value does not match its type')
    return parsed
  }
  if (type === 'boolean') {
    if (!['true', 'false'].includes(value)) throw new Error('Parameter value does not match its type')
    return value === 'true'
  }
  if (type === 'number' || type === 'integer') {
    if (!value.trim() || !Number.isFinite(Number(value)) || (type === 'integer' && !Number.isInteger(Number(value))))
      throw new Error('Parameter value does not match its type')
  }
  return value
}

export type RestRequestDraft = {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  form?: [string, string][]
  formType?: string
  issues: string[]
}
export function restRequestDraft(
  address: string,
  slug: string,
  operation: RestOperation,
  parameters: RestParameter[],
  values: Record<string, string>,
  mediaType: string,
  body: string
): RestRequestDraft {
  let path = operation.path
  const query = new URLSearchParams(),
    headers: Record<string, string> = {},
    issues: string[] = [],
    form: [string, string][] = []
  for (const parameter of parameters) {
    if (
      parameter.in === 'cookie' ||
      (parameter.in === 'header' && /^(authorization|x-api-key|x-goog-api-key|new-api-user|x-auth-session)$/i.test(parameter.name))
    )
      continue
    const raw = values[`${parameter.in}:${parameter.name}`] ?? ''
    if (!raw) {
      if (parameter.required) issues.push(`${parameter.name}: Required parameter`)
      continue
    }
    let value: unknown
    try {
      value = parameterValue(parameter, raw)
    } catch {
      issues.push(`${parameter.name}: Parameter value does not match its type`)
      continue
    }
    if (parameter.in === 'path') {
      const encode = (item: unknown) => encodeURIComponent(String(item)).replaceAll("'", '%27')
      const entries = Object.entries(object(value)),
        name = encode(parameter.name)
      let encoded = encode(value)
      if (Array.isArray(value)) encoded = value.map(encode).join(',')
      else if (value && typeof value === 'object')
        encoded = entries.map(([key, item]) => (parameter.explode ? `${encode(key)}=${encode(item)}` : `${encode(key)},${encode(item)}`)).join(',')
      if (parameter.style === 'label') encoded = '.' + encoded.replaceAll(',', '.')
      if (parameter.style === 'matrix') {
        if (parameter.explode && Array.isArray(value)) encoded = value.map((item) => `;${name}=${encode(item)}`).join('')
        else if (parameter.explode && value && typeof value === 'object')
          encoded = entries.map(([key, item]) => `;${encode(key)}=${encode(item)}`).join('')
        else encoded = `;${name}=${encoded}`
      }
      path = path.replaceAll(`{${parameter.name}}`, encoded)
    } else if (parameter.in === 'query' || parameter.in === 'formData') {
      const pairs: [string, string][] = []
      if (Array.isArray(value)) {
        const multi = parameter.collectionFormat === 'multi' || (!parameter.collectionFormat && parameter.explode && parameter.style === 'form')
        let separator = ','
        if (parameter.style === 'spaceDelimited' || parameter.collectionFormat === 'ssv') separator = ' '
        if (parameter.style === 'pipeDelimited' || parameter.collectionFormat === 'pipes') separator = '|'
        if (parameter.collectionFormat === 'tsv') separator = '\t'
        if (multi) for (const item of value) pairs.push([parameter.name, String(item)])
        else pairs.push([parameter.name, value.map(String).join(separator)])
      } else if (value && typeof value === 'object') {
        const entries = Object.entries(object(value))
        if (parameter.style === 'deepObject') for (const [name, item] of entries) pairs.push([`${parameter.name}[${name}]`, String(item)])
        else if (parameter.explode) for (const [name, item] of entries) pairs.push([name, String(item)])
        else pairs.push([parameter.name, entries.flatMap(([key, item]) => [key, String(item)]).join(',')])
      } else pairs.push([parameter.name, String(value)])
      if (parameter.in === 'formData') form.push(...pairs)
      else for (const [key, item] of pairs) query.append(key, item)
    } else if (
      parameter.in === 'header' &&
      !/^(authorization|cookie|host|content-length|x-api-key|x-goog-api-key|new-api-user|x-auth-session)$/i.test(parameter.name)
    )
      headers[parameter.name] = Array.isArray(value) ? value.join(',') : String(value)
  }
  const suffix = query.toString()
  const result: RestRequestDraft = {
    url: `${address.replace(/\/$/, '')}/v1/rest/${encodeURIComponent(slug)}${path}${suffix ? '?' + suffix : ''}`,
    method: operation.method,
    headers,
    issues,
  }
  if (!['GET', 'HEAD'].includes(operation.method) && body && ['application/x-www-form-urlencoded', 'multipart/form-data'].includes(mediaType)) {
    try {
      const data: unknown = JSON.parse(body)
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid JSON request body')
      for (const [name, value] of Object.entries(object(data)))
        for (const item of Array.isArray(value) ? value : [value]) form.push([name, typeof item === 'object' ? JSON.stringify(item) : String(item)])
    } catch {
      issues.push('Invalid JSON request body')
    }
  } else if (!['GET', 'HEAD'].includes(operation.method) && body) {
    headers['Content-Type'] = mediaType || 'application/json'
    result.body = body
    if (headers['Content-Type'].includes('json'))
      try {
        JSON.parse(body)
      } catch {
        issues.push('Invalid JSON request body')
      }
  }
  if (form.length && !result.body) {
    result.form = form
    result.formType = mediaType || 'application/x-www-form-urlencoded'
  }
  return result
}

export function restCodeExample(request: RestRequestDraft, language: ExampleLanguage): string {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  const multipart = request.formType === 'multipart/form-data'
  const body = request.body ?? (request.form && !multipart ? new URLSearchParams(request.form).toString() : undefined)
  const headers = { ...request.headers }
  if (request.form && !multipart) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  if (language === 'curl')
    return [
      `curl --request ${request.method} ${quote(request.url)}`,
      '  --header "Authorization: Bearer $NEW_API_KEY"',
      ...Object.entries(headers).map(([name, value]) => `  --header ${quote(`${name}: ${value}`)}`),
      ...(body !== undefined ? [`  --data-raw ${quote(body)}`] : []),
      ...(multipart ? (request.form || []).map(([name, value]) => `  --form-string ${quote(`${name}=${value}`)}`) : []),
    ].join(' \\\n')
  if (language === 'javascript')
    return `${multipart ? `const form = new FormData();\n${(request.form || []).map(([name, value]) => `form.append(${JSON.stringify(name)}, ${JSON.stringify(value)});`).join('\n')}\n` : ''}const response = await fetch(${JSON.stringify(request.url)}, {\n  method: ${JSON.stringify(request.method)},\n  headers: { ...${JSON.stringify(headers)}, Authorization: \`Bearer \${process.env.NEW_API_KEY}\` },${body !== undefined ? `\n  body: ${JSON.stringify(body)},` : ''}${multipart ? '\n  body: form,' : ''}\n});\nconsole.log(response.status, await response.text());`
  return `import json, os, requests\n\nheaders = json.loads(${JSON.stringify(JSON.stringify(headers))})\nheaders['Authorization'] = 'Bearer ' + os.environ['NEW_API_KEY']\nresponse = requests.request(${JSON.stringify(request.method)}, ${JSON.stringify(request.url)},\n    headers=headers${body !== undefined ? `, data=${JSON.stringify(body)}.encode('utf-8')` : ''}${multipart ? `, files=[(name, (None, value)) for name, value in json.loads(${JSON.stringify(JSON.stringify(request.form))})]` : ''})\nprint(response.status_code, response.text)`
}
