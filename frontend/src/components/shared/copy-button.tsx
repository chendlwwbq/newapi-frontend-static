'use client'
// Rebuilt from New API's shared CopyButton, with the same clipboard behavior.
import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function CopyButton({
  value,
  label,
  showLabel = false,
  disabled = false,
  className,
}: {
  value: string
  label?: string
  showLabel?: boolean
  disabled?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const { t } = useTranslation()

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      setCopied(true)
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        setCopied(false)
      }, 1800)
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
        className={cn(copied && 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', className)}
      >
        {copied ? <Check size={15} className="scale-110 text-emerald-500 transition-transform dark:text-emerald-400" /> : <Copy size={15} />}
        {showLabel && (copied ? t('Copied') : label || t('Copy'))}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? t('Copied') : ''}
      </span>
    </>
  )
}
