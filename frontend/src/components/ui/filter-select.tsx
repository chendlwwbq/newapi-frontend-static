'use client'

import { Selector, type SelectorOptionData } from '@astryxdesign/core/Selector'
import { InternationalizationProvider } from '@astryxdesign/core/i18n'
import { useTranslation } from 'react-i18next'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'
import '@/styles/filter-select.css'

interface FilterSelectProps {
  label: string
  value: string
  options: SelectorOptionData[]
  onChange: (value: string) => void
  hideLabel?: boolean
  className?: string
  disabled?: boolean
}

/** A controlled filter: selecting an option never submits its surrounding form. */
export function FilterSelect(props: FilterSelectProps) {
  const { t, i18n } = useTranslation()
  return (
    <div className={cn('filter-select', props.className)} data-astryx-theme="neutral">
      <InternationalizationProvider locale={toIntlLocale(i18n.resolvedLanguage || i18n.language) || 'en'}>
        <Selector
          label={props.label}
          isLabelHidden={props.hideLabel}
          value={props.value}
          options={props.options}
          onChange={props.onChange}
          isDisabled={props.disabled}
          size="md"
          placement="below"
          placeholder={props.options[0]?.label ?? t('No results found')}
          emptyText={t('No results found')}
          controlClassName="filter-select-control"
        />
      </InternationalizationProvider>
    </div>
  )
}
