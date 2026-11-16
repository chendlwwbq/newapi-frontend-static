'use client'
import { Inbox, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

export function EmptyState({ title, description, icon }: { title?: string; description?: string; icon?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="empty-state">
      {icon ?? <Inbox size={30} strokeWidth={1.2} />}
      <h3>{title || t('No data yet')}</h3>
      {description && <p>{description}</p>}
    </div>
  )
}

export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="error-state" role="alert">
      <p>{error.message.trim() ? t(error.message) : t('Request failed')}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          <RotateCw size={14} />
          {t('Retry')}
        </Button>
      )}
    </div>
  )
}

export function LoadingState() {
  const { t } = useTranslation()
  return (
    <div className="loading-state" role="status" aria-label={t('Loading')}>
      <div />
      <div />
      <div />
    </div>
  )
}
