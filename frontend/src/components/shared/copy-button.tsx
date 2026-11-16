'use client'
// Rebuilt from New API's shared CopyButton, with the same clipboard behavior.
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function CopyButton({
  value,
  label,
  showLabel = false,
  disabled = false,
}: {
  value: string
  label?: string
  showLabel?: boolean
  disabled?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={showLabel ? 'outline' : 'ghost'}
        size={showLabel ? 'default' : 'icon'}
        disabled={disabled}
        onClick={copy}
        aria-label={label || t('Copy')}
        title={copied ? t('Copied') : t('Copy')}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {showLabel && (copied ? t('Copied') : label || t('Copy'))}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? t('Copied') : ''}
      </span>
    </>
  )
}
