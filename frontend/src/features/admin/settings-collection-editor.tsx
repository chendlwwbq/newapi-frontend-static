'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { isRecord, settingsCollections, settingsStringListKeys } from './lib/settings-collections'
import { SettingList } from './setting-list'
import { ContentPreview } from '@/components/shared/content-preview'
import { CatalogNoticeSuggestions } from './catalog-notice-suggestions'
import { AnnouncementItem, ApiInfoItem, FaqItem } from '@/features/dashboard/configured-panels'

const choiceLabels: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  default: 'Default',
  ongoing: 'Ongoing',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  blue: 'Blue',
  green: 'Green',
  cyan: 'Cyan',
  purple: 'Purple',
  pink: 'Pink',
  red: 'Red',
  orange: 'Orange',
  amber: 'Amber',
  yellow: 'Yellow',
  lime: 'Lime',
  'light-green': 'Light green',
  teal: 'Teal',
  'light-blue': 'Light blue',
  indigo: 'Indigo',
  violet: 'Violet',
  grey: 'Grey',
  slate: 'Slate',
}

export function SettingsCollectionEditor({
  optionKey,
  value,
  onChange,
  id,
}: {
  optionKey: string
  value: string
  onChange: (value: string) => void
  id: string
}) {
  const { t } = useTranslation(),
    [raw, setRaw] = useState(false)
  let rows: Record<string, unknown>[] | null = null
  let strings: string[] | null = null
  const spec = settingsCollections[optionKey],
    chats = optionKey === 'Chats',
    stringList = settingsStringListKeys.has(optionKey)
  if (!spec && !chats && !stringList)
    return <Textarea id={id} rows={5} aria-label={t('Raw JSON')} value={value} onChange={(event) => onChange(event.target.value)} />
  try {
    const parsed: unknown = JSON.parse(value || '[]')
    if (stringList && Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) strings = parsed
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (row) =>
          isRecord(row) &&
          (chats
            ? Object.keys(row).length === 1 && typeof Object.values(row)[0] === 'string'
            : spec?.fields.every(
                (field) =>
                  row[field.key] === undefined ||
                  (field.kind === 'string-list'
                    ? Array.isArray(row[field.key]) && (row[field.key] as unknown[]).every((item) => typeof item === 'string')
                    : typeof row[field.key] === (field.kind === 'number' ? 'number' : 'string') || (field.kind === 'number' && row[field.key] === ''))
              ))
      )
    )
      rows = parsed
  } catch {
    /* Keep the complete raw draft when it cannot be represented. */
  }
  if (stringList) {
    let label = 'Domain'
    if (optionKey === 'fetch_setting.ip_list') label = 'IP or CIDR'
    if (optionKey === 'fetch_setting.allowed_ports') label = 'Port or range'
    let content = <Textarea aria-label={t('Raw JSON')} rows={8} value={value} onChange={(event) => onChange(event.target.value)} />
    if (!raw && strings !== null)
      content = <SettingList label={t(label)} value={strings} onChange={(next) => onChange(JSON.stringify(next, null, 2))} />
    return (
      <div className="settings-collection" id={id}>
        <div className="settings-collection-toolbar">
          <Button type="button" size="sm" variant="outline" disabled={strings === null} onClick={() => setRaw((previous) => !previous)}>
            {t(raw || strings === null ? 'Visual editor' : 'Raw JSON')}
          </Button>
        </div>
        {content}
      </div>
    )
  }
  function update(next: Record<string, unknown>[]) {
    onChange(JSON.stringify(next, null, 2))
  }
  const visual = !!(spec || chats) && rows !== null
  return (
    <div className="settings-collection" id={id}>
      <div className="settings-collection-toolbar">
        <Button type="button" size="sm" variant="outline" disabled={!visual} onClick={() => setRaw((previous) => !previous)}>
          {t(raw || !visual ? 'Visual editor' : 'Raw JSON')}
        </Button>
        <span className="small-note">{t('Unknown properties are preserved.')}</span>
      </div>
      {optionKey === 'OrbisCatalogNotices' && (
        <p className="small-note">
          {t('Use catalog model keys or model IDs, group names, and offering keys. Filled target lists must match the same model and route.')}
        </p>
      )}
      {optionKey === 'OrbisCatalogNotices' && !raw && visual && <CatalogNoticeSuggestions id={id} />}
      {raw || !visual ? (
        <Textarea
          aria-label={t('Raw JSON')}
          rows={8}
          className="admin-pricing-expression"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <>
          {rows!.map((row, index) => (
            <section className="settings-collection-row" key={index} aria-label={`${t('Item')} ${index + 1}`}>
              <div className="settings-collection-toolbar">
                <strong>
                  {t('Item')} {index + 1}
                </strong>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...rows!]
                      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                      update(next)
                    }}
                  >
                    {t('Move up')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === rows!.length - 1}
                    onClick={() => {
                      const next = [...rows!]
                      ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                      update(next)
                    }}
                  >
                    {t('Move down')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => update(rows!.filter((_, position) => position !== index))}>
                    {t('Remove')}
                  </Button>
                </div>
              </div>
              {chats ? (
                <div className="settings-collection-grid">
                  <label>
                    {t('Name')}
                    <Input
                      value={Object.keys(row)[0]}
                      onChange={(event) =>
                        update(rows!.map((item, position) => (position === index ? { [event.target.value]: Object.values(row)[0] } : item)))
                      }
                    />
                  </label>
                  <label>
                    {t('URL')}
                    <Input
                      value={String(Object.values(row)[0])}
                      onChange={(event) =>
                        update(rows!.map((item, position) => (position === index ? { [Object.keys(row)[0]]: event.target.value } : item)))
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className="settings-collection-grid">
                  {spec.fields.map((field) => {
                    const fieldId = `${id}-${index}-${field.key}`
                    function change(content: string) {
                      const next = { ...row, [field.key]: field.kind === 'number' && content !== '' ? Number(content) : content }
                      update(rows!.map((item, position) => (position === index ? next : item)))
                    }
                    return (
                      <div className="field" key={field.key}>
                        {field.kind === 'string-list' ? <span>{t(field.label)}</span> : <label htmlFor={fieldId}>{t(field.label)}</label>}
                        {field.kind === 'string-list' ? (
                          <SettingList
                            label={t(field.label)}
                            list={optionKey === 'OrbisCatalogNotices' ? `${id}-suggestions-${field.key}` : undefined}
                            value={(row[field.key] as string[] | undefined) ?? []}
                            onChange={(next) => update(rows!.map((item, position) => (position === index ? { ...row, [field.key]: next } : item)))}
                          />
                        ) : field.kind === 'textarea' ? (
                          <Textarea
                            id={fieldId}
                            value={String(row[field.key] ?? '')}
                            maxLength={field.max}
                            onChange={(event) => change(event.target.value)}
                          />
                        ) : field.kind === 'select' ? (
                          <select id={fieldId} value={String(row[field.key] ?? '')} onChange={(event) => change(event.target.value)}>
                            <option value="">—</option>
                            {field.choices?.map((choice) => (
                              <option key={choice} value={choice}>
                                {t(choiceLabels[choice] || choice)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={fieldId}
                            type={field.kind === 'number' ? 'number' : 'text'}
                            step="any"
                            maxLength={field.max}
                            value={String(row[field.key] ?? '')}
                            onChange={(event) => change(event.target.value)}
                          />
                        )}
                        {optionKey === 'EvaNewsArticles' && field.key === 'body' && <ContentPreview source={String(row[field.key] ?? '')} />}
                      </div>
                    )
                  })}
                </div>
              )}
              {['console_setting.announcements', 'console_setting.faq', 'console_setting.api_info'].includes(optionKey) && (
                <details className="settings-collection-preview">
                  <summary>{t('Preview')}</summary>
                  <div className="console-notice-list">
                    {optionKey === 'console_setting.announcements' && (
                      <AnnouncementItem
                        item={{
                          id: index,
                          content: String(row.content ?? ''),
                          publishDate: String(row.publishDate ?? ''),
                          type: String(row.type ?? ''),
                          extra: String(row.extra ?? ''),
                        }}
                      />
                    )}
                    {optionKey === 'console_setting.faq' && (
                      <FaqItem item={{ id: index, question: String(row.question ?? ''), answer: String(row.answer ?? '') }} />
                    )}
                    {optionKey === 'console_setting.api_info' && (
                      <ApiInfoItem
                        item={{ id: index, description: String(row.description ?? ''), route: String(row.route ?? ''), url: String(row.url ?? '') }}
                      />
                    )}
                  </div>
                </details>
              )}
            </section>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!!spec?.limit && rows!.length >= spec.limit}
            onClick={() => {
              const row: Record<string, unknown> = chats
                ? { '': '' }
                : { ...Object.fromEntries(spec.fields.filter((field) => !field.optional).map((field) => [field.key, ''])), ...spec.defaults }
              if (spec?.id) row.id = Math.max(0, ...rows!.map((item) => (typeof item.id === 'number' ? item.id : 0))) + 1
              if (optionKey === 'console_setting.announcements') row.publishDate = new Date().toISOString()
              if (optionKey === 'EvaNewsArticles') row.slug = `article-${row.id}`
              update([...rows!, row])
            }}
          >
            {t('Add item')}
          </Button>
        </>
      )}
    </div>
  )
}
