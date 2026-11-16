'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  return (
    <div className="json-value-input">
      <Textarea
        ref={input}
        aria-label={props.label}
        aria-invalid={invalid}
        aria-describedby={invalid ? id : undefined}
        rows={props.objectOnly ? 5 : 2}
        className="admin-pricing-expression"
        value={draft}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          try {
            const value: unknown = JSON.parse(text)
            if (props.objectOnly && value !== null && (typeof value !== 'object' || Array.isArray(value))) throw new Error('object')
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
