'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState } from '@/components/shared/states'
import { useGatewayAddress } from '@/features/docs/use-gateway-address'
import type { ExampleLanguage } from '@/features/docs/api-examples'
import { useQuotaFormatter } from '@/lib/format'
import type { RestDefinition, RestOperation } from './types'
import {
  operationParameters,
  parameterInitialValue,
  requestMedia,
  responseMedia,
  restRequestDraft,
  restCodeExample,
  schemaFields,
  type JsonObject,
  type SchemaField,
} from './openapi-reference'

function SchemaTable(props: { fields: SchemaField[] }) {
  const { t } = useTranslation()
  if (!props.fields.length) return null
  return (
    <div className="table-wrap">
      <table className="data-table rest-schema-table">
        <thead>
          <tr>
            <th>{t('Field name')}</th>
            <th>{t('Type')}</th>
            <th>{t('Description')}</th>
          </tr>
        </thead>
        <tbody>
          {props.fields.map((field, index) => (
            <tr key={`${field.name}-${index}`}>
              <td>
                <code>{field.name}</code>
                {field.required && <span className="rest-required">{t('Required')}</span>}
              </td>
              <td>
                <code>{field.type}</code>
              </td>
              <td>{field.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RestOperationReference(props: { api: RestDefinition; operation: RestOperation }) {
  const { t } = useTranslation(),
    formatQuota = useQuotaFormatter(),
    gateway = useGatewayAddress()
  const operation = props.operation,
    root: JsonObject = props.api.schemas || {}
  const parameters = operationParameters(operation, root),
    media = requestMedia(operation, root),
    responses = responseMedia(operation, root)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(parameters.map((parameter) => [`${parameter.in}:${parameter.name}`, parameterInitialValue(parameter, root)]))
  )
  const [mediaType, setMediaType] = useState(media[0]?.type || '')
  const selectedMedia = media.find((item) => item.type === mediaType)
  const [body, setBody] = useState(() => {
    const example = media[0]?.example
    if (example === undefined) return ''
    return typeof example === 'string' && !media[0].type.includes('json') ? example : JSON.stringify(example, null, 2)
  })
  const [language, setLanguage] = useState<ExampleLanguage>('curl'),
    [responseStatus, setResponseStatus] = useState(responses[0]?.status || '')
  const request = restRequestDraft(gateway.address || 'https://YOUR_GATEWAY', props.api.slug, operation, parameters, values, mediaType, body)
  if (selectedMedia?.required && !body) request.issues.push('Request body is required')
  const selectedResponse = responses.find((item) => item.status === responseStatus)
  const code = restCodeExample(request, language)
  return (
    <div className="rest-reference">
      <div className="rest-call-meta">
        <p>
          {t('Base price per call')}{' '}
          <strong>{operation.quota == null ? t('Pricing not configured') : formatQuota(operation.quota, { digitsSmall: 6, digitsLarge: 6 })}</strong>
        </p>
        <p>
          {t('API key model restriction')} <code>rest/{props.api.slug}</code>
        </p>
        <span className={`status-badge ${props.api.relay_available ? 'success' : ''}`}>
          {t(props.api.relay_available ? 'Upstream configured' : 'Upstream not configured')}
        </span>
      </div>
      <div className="rest-reference-grid">
        <div className="rest-request-fields">
          <h3>{t('Parameters')}</h3>
          {!parameters.length && <p className="small-note">{t('No parameter metadata.')}</p>}
          <div className="rest-parameter-list">
            {parameters.map((parameter) => {
              const key = `${parameter.in}:${parameter.name}`,
                schema = parameter.schema
              const credential =
                /^(authorization|x-api-key|x-goog-api-key|new-api-user|x-auth-session)$/i.test(parameter.name) && parameter.in === 'header'
              const serverOnly = parameter.in === 'cookie' || credential
              return (
                <div className="rest-parameter" key={key}>
                  <label className="field">
                    <span>
                      <code>{parameter.name}</code>{' '}
                      <small>
                        {parameter.in} · {String(schema.type || 'string')}
                      </small>
                      {parameter.required && <span className="rest-required">{t('Required')}</span>}
                    </span>
                    <p className="small-note">{parameter.description}</p>
                    {serverOnly ? (
                      <small>{t('Configure this credential on the server. The gateway does not forward client credentials.')}</small>
                    ) : (
                      <Input
                        aria-label={`${parameter.in}: ${parameter.name}`}
                        value={values[key] ?? ''}
                        onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                        placeholder={schema.type === 'array' ? '["value"]' : String(schema.type || 'string')}
                      />
                    )}
                    {Array.isArray(schema.enum) && (
                      <small>
                        {t('Allowed values')}: {schema.enum.map((value) => JSON.stringify(value)).join(', ')}
                      </small>
                    )}
                  </label>
                </div>
              )
            })}
          </div>
          {media.length > 0 && (
            <section>
              <div className="section-heading">
                <h3>{t('Request body')}</h3>
                <label className="field">
                  <span className="sr-only">{t('Content type')}</span>
                  <select
                    aria-label={t('Content type')}
                    value={mediaType}
                    onChange={(event) => {
                      const selected = media.find((item) => item.type === event.target.value)
                      setMediaType(event.target.value)
                      setBody(selected?.example === undefined ? '' : JSON.stringify(selected.example, null, 2))
                    }}
                  >
                    {media.map((item) => (
                      <option key={item.type}>{item.type}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Textarea aria-label={t('Request body')} rows={10} value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} />
              <SchemaTable fields={schemaFields(selectedMedia?.schema, root)} />
            </section>
          )}
        </div>
        <section className="rest-code-panel">
          <div className="section-heading">
            <h3>{t('Request example')}</h3>
            <CopyButton value={code} />
          </div>
          <div className="rest-code-languages" role="group" aria-label={t('Code language')}>
            {(['curl', 'javascript', 'python'] as const).map((value) => (
              <Button
                variant={language === value ? 'default' : 'ghost'}
                type="button"
                aria-pressed={language === value}
                onClick={() => setLanguage(value)}
                key={value}
              >
                {value}
              </Button>
            ))}
          </div>
          <pre className="rest-call-example">{code}</pre>
          {gateway.error && <ErrorState error={gateway.error} retry={gateway.retry} />}
          {request.issues.length > 0 && (
            <ul className="rest-example-issues" role="status">
              {request.issues.map((issue) => {
                const split = issue.indexOf(': ')
                return (
                  <li key={issue}>
                    {split < 0 ? (
                      t(issue)
                    ) : (
                      <>
                        <code>{issue.slice(0, split)}</code>: {t(issue.slice(split + 2))}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="small-note">{t('Editing parameters only updates these examples. Copy the code to send a request.')}</p>
          <Button
            variant="outline"
            onClick={() => {
              setValues(
                Object.fromEntries(parameters.map((parameter) => [`${parameter.in}:${parameter.name}`, parameterInitialValue(parameter, root)]))
              )
              setBody(selectedMedia?.example === undefined ? '' : JSON.stringify(selectedMedia.example, null, 2))
            }}
          >
            {t('Reset example')}
          </Button>
        </section>
      </div>
      {responses.length > 0 && (
        <section className="rest-responses">
          <div className="section-heading">
            <h3>{t('Responses')}</h3>
            <label className="field">
              <span className="sr-only">{t('Response status')}</span>
              <select aria-label={t('Response status')} value={responseStatus} onChange={(event) => setResponseStatus(event.target.value)}>
                {responses.map((response) => (
                  <option key={response.status}>{response.status}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="small-note">{selectedResponse?.description}</p>
          {selectedResponse?.media.map((item) => (
            <div key={item.type}>
              <p className="small-note">
                <code>{item.type}</code>
              </p>
              <SchemaTable fields={schemaFields(item.schema, root, 'response')} />
              {item.example !== undefined && (
                <div className="rest-response-example">
                  <CopyButton value={JSON.stringify(item.example, null, 2)} />
                  <pre className="rest-call-example">{JSON.stringify(item.example, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
