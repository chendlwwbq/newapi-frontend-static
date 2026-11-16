'use client'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SettingList(props: {
  value: (string | number)[]
  onChange: (next: (string | number)[]) => void
  numeric?: boolean
  label: string
  list?: string
}) {
  const { t } = useTranslation()
  return (
    <div className="model-setting-list">
      {props.value.map((value, index) => (
        <div className="model-setting-item" key={index}>
          <Input
            aria-label={`${props.label} ${index + 1}`}
            list={props.list}
            type={props.numeric ? 'number' : 'text'}
            min={props.numeric ? 1 : undefined}
            step={props.numeric ? 1 : undefined}
            required={props.numeric}
            value={value}
            onChange={(event) =>
              props.onChange(
                props.value.map((item, i) => {
                  if (i !== index) return item
                  return props.numeric && event.target.value !== '' ? Number(event.target.value) : event.target.value
                })
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`${t('Remove')} ${props.label} ${index + 1}`}
            onClick={() => props.onChange(props.value.filter((_, i) => i !== index))}
          >
            {t('Remove')}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => props.onChange([...props.value, ''])}>
        {t('Add item')}
      </Button>
    </div>
  )
}
