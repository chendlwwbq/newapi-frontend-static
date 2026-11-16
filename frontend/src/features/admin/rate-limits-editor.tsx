'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { isRecord } from './lib/settings-collections'

export function RateLimitsEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation(),
    [raw, setRaw] = useState(false),
    [group, setGroup] = useState('')
  let limits: Record<string, (number | null)[]> | null = null
  try {
    const parsed: unknown = JSON.parse(value || '{}')
    if (
      isRecord(parsed) &&
      Object.values(parsed).every((row) => Array.isArray(row) && row.length === 2 && row.every((item) => item === null || typeof item === 'number'))
    )
      limits = parsed as Record<string, (number | null)[]>
  } catch {
    /* Preserve existing raw input rather than dropping unsupported rows. */
  }
  return (
    <div className="settings-collection">
      <div className="settings-collection-toolbar">
        <Button type="button" size="sm" variant="outline" disabled={!limits} onClick={() => setRaw((previous) => !previous)}>
          {t(raw || !limits ? 'Visual editor' : 'Raw JSON')}
        </Button>
      </div>
      {raw || !limits ? (
        <Textarea rows={6} aria-label={t('Group rate limits')} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <>
          {Object.entries(limits).map(([name, row]) => (
            <div className="settings-collection-row settings-rate-row" key={name}>
              <strong>{name}</strong>
              {['Max requests per period', 'Max successful requests'].map((label, index) => (
                <label className="field" key={label}>
                  <span>{t(label)}</span>
                  <Input
                    type="number"
                    min={index === 0 ? 0 : 1}
                    max={2147483647}
                    step={1}
                    value={row[index] ?? ''}
                    onChange={(event) =>
                      onChange(
                        JSON.stringify(
                          {
                            ...limits,
                            [name]: row.map((item, position) =>
                              position === index ? (event.target.value === '' ? null : Number(event.target.value)) : item
                            ),
                          },
                          null,
                          2
                        )
                      )
                    }
                  />
                </label>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = { ...limits }
                  delete next[name]
                  onChange(JSON.stringify(next, null, 2))
                }}
              >
                {t('Remove')}
              </Button>
            </div>
          ))}
          <div className="settings-collection-toolbar">
            <Input aria-label={t('Group')} placeholder={t('Group')} value={group} onChange={(event) => setGroup(event.target.value)} />
            <Button
              type="button"
              variant="outline"
              disabled={!group.trim() || Object.hasOwn(limits, group.trim())}
              onClick={() => {
                onChange(JSON.stringify({ ...limits, [group.trim()]: [0, 1] }, null, 2))
                setGroup('')
              }}
            >
              {t('Add')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
