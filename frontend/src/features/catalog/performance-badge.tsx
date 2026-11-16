'use client'

import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'

export function CatalogPerformanceBadge({ successRate, filtered = false }: { successRate: number | null; filtered?: boolean }) {
  const { t, i18n } = useTranslation()
  if (successRate === null) return null
  return (
    <div
      className="catalog-performance-badge"
      title={t(
        filtered
          ? 'Last 24 hours across selected groups. Only observed samples are shown.'
          : 'Last 24 hours across all active groups. Only observed samples are shown.'
      )}
    >
      <span>{t('Last 24 hours')}</span>
      <span>
        {t('Success rate')} <strong>{formatNumber(successRate, toIntlLocale(i18n.resolvedLanguage || i18n.language))}%</strong>
      </span>
    </div>
  )
}
