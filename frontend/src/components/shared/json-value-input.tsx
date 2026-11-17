'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/** Keeps incomplete JSON visible and uses form validation to prevent stale saves. */
export function JsonValueInput(props: { value: unknown; onChange: (value: unknown) => void; objectOnly?: boolean; label: string }) {
  const { t } = useTranslation(),
    id = useId(),
    input = useRef<HTMLTextAreaElement>(null)
  const serialized = JSON.stringify(props.value, null, 2) ?? 'null'
  const [draft, setDraft] = useState(serialized),
    [invalid, setInvalid] = useState(false)
  const message = t(props.objectOnly ? 'Enter a JSON object or null.' : 'Enter a valid JSON value. Strings must use double quotes.')
  useEffect(() => {
    setDraft(serialized)
    setInvalid(false)
    input.current?.setCustomValidity('')
  }, [serialized])
  function parseDraft(text: string): unknown {
    const value: unknown = JSON.parse(text)
    if (props.objectOnly && value !== null && (typeof value !== 'object' || Array.isArray(value))) throw new Error('object')
    return value
  }
  function formatJson() {
    try {
      const value = parseDraft(draft)
      const formatted = JSON.stringify(value, null, 2) ?? 'null'
      setDraft(formatted)
      setInvalid(false)
      input.current?.setCustomValidity('')
      props.onChange(value)
    } catch {
      input.current?.setCustomValidity(message)
      setInvalid(true)
    }
  }
  return (
    <div className="json-value-input">
      <div className="mb-1 flex justify-end">
        <Button type="button" variant="ghost" size="xs" onClick={formatJson}>
          {t('Format JSON')}
        </Button>
      </div>
      <Textarea
        ref={input}
        aria-label={props.label}
        aria-invalid={invalid}
        aria-describedby={invalid ? id : undefined}
        rows={props.objectOnly ? 5 : 2}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="admin-pricing-expression font-mono text-xs"
        value={draft}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          try {
            const value = parseDraft(text)
            event.target.setCustomValidity('')
            setInvalid(false)
            props.onChange(value)
          } catch {
            event.target.setCustomValidity(message)
            setInvalid(true)
          }
        }}
      />
      {invalid && (
        <small id={id} className="settings-inline-error">
          {message}
        </small>
      )}
    </div>
  )
}
