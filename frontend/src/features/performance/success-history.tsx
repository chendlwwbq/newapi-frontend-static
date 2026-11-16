'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'

export function SuccessHistory({ points }: { points: { ts: number; success_rate: number }[] }) {
  const { t, i18n } = useTranslation(),
    locale = toIntlLocale(i18n.language)
  const [active, setActive] = useState(0)
  const samples = points.slice(-24)
  if (!samples.length) return null
  const current = Math.min(active, samples.length - 1)
  return (
    <span className="success-samples" role="group" aria-label={t('Observed success rate samples')}>
      {samples.map((point, index) => {
        const label = `${new Date(point.ts * 1000).toLocaleString(locale, { hour12: false })}: ${formatNumber(point.success_rate, locale)}%`
        return (
          <span
            role="img"
            tabIndex={index === current ? 0 : -1}
            key={point.ts}
            aria-label={label}
            title={label}
            data-label={label}
            onFocus={() => setActive(index)}
            onKeyDown={(event) => {
              let next: number
              if (event.key === 'ArrowRight') next = (index + 1) % samples.length
              else if (event.key === 'ArrowLeft') next = (index - 1 + samples.length) % samples.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = samples.length - 1
              else return
              event.preventDefault()
              setActive(next)
              event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="img"]')[next]?.focus()
            }}
            style={{ background: `color-mix(in srgb, var(--success) ${point.success_rate}%, var(--destructive))` }}
          />
        )
      })}
    </span>
  )
}
