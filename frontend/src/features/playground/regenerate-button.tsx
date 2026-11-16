'use client'

import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function RegenerateButton<T>({
  messages,
  index,
  conversationId,
  onGenerate,
  disabled = false,
}: {
  messages: T[]
  index: number
  conversationId: string
  onGenerate: (history: T[], conversationId?: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const branch = index < messages.length - 1
  const label = t(branch ? 'Regenerate in new conversation' : 'Regenerate')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={() => onGenerate(messages.slice(0, index), branch ? undefined : conversationId)}
    >
      <RotateCcw size={13} />
    </Button>
  )
}
