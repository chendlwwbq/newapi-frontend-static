'use client'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { JsonValueInput } from '@/components/shared/json-value-input'
import type { ContainerDraft } from './types'
export function ContainerFields(props: { value: ContainerDraft; onChange: (patch: Partial<ContainerDraft>) => void; updating?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="admin-form-grid">
      <label className="field">
        <span>{t('Container image')}</span>
        <Input required={!props.updating} value={props.value.image} onChange={(event) => props.onChange({ image: event.target.value })} />
      </label>
      <label className="field">
        <span>{t('Traffic port')}</span>
        <Input
          type="number"
          min={1}
          max={65535}
          step={1}
          value={props.value.port}
          onChange={(event) => props.onChange({ port: event.target.value })}
        />
      </label>
      <label className="field">
        <span>{t('Registry username')}</span>
        <Input autoComplete="off" value={props.value.registryUser} onChange={(event) => props.onChange({ registryUser: event.target.value })} />
      </label>
      <label className="field">
        <span>{t('Registry secret')}</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={props.value.registrySecret}
          onChange={(event) => props.onChange({ registrySecret: event.target.value })}
        />
      </label>
      {(['env', 'secrets', 'entrypoint', 'args'] as const).map((key) => {
        const labels = {
          env: 'Environment variables',
          secrets: 'Secret environment variables',
          entrypoint: 'Entrypoint (JSON array)',
          args: 'Arguments (JSON array)',
        }
        return (
          <div className="field admin-wide" key={key}>
            <span>{t(labels[key])}</span>
            <JsonValueInput
              objectOnly={key === 'env' || key === 'secrets'}
              label={t(labels[key])}
              value={props.value[key]}
              onChange={(value) => props.onChange({ [key]: value })}
            />
          </div>
        )
      })}
      {props.updating && (
        <label className="field admin-wide">
          <span>{t('Command')}</span>
          <Input value={props.value.command} onChange={(event) => props.onChange({ command: event.target.value })} />
        </label>
      )}
      <p className="small-note admin-wide">
        {t('Optional blank fields keep provider settings. Stored registry and environment secrets are never prefilled.')}
      </p>
    </div>
  )
}
