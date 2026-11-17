'use client'
import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CHANNEL_TYPES } from './channel-types'
import { channelRequest, type ChannelDraft } from './lib/channel-form'
import { PrefillSelect } from './prefill-select'
import { ChannelPluginFields } from './channel-plugin-fields'
import { ChannelProviderFields } from './channel-provider-fields'
import { channelProviderTypeChange } from './lib/channel-provider'
import { AdvancedChannelFields } from './advanced-channel-fields'
import { ChannelCommonFields } from './channel-common-fields'

export function ChannelEditor({
  initial,
  sensitive,
  pluginBind,
  ownerId,
  onClose,
}: {
  initial: ChannelDraft
  sensitive: boolean
  pluginBind: boolean
  ownerId: number
  onClose: () => void
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [draft, setDraft] = useState(initial),
    [error, setError] = useState(''),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [advancedOpen, setAdvancedOpen] = useState(false)
  const save = useMutation({
    gcTime: 0,
    mutationFn: (body: ReturnType<typeof channelRequest>) => api('/api/channel', { method: draft.id ? 'PUT' : 'POST', body }),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['admin-channels'] })
      void queries.invalidateQueries({ queryKey: ['channel-name-cache'] })
      toast.success(t('Saved'))
      onClose()
    },
    onError: (error) => setError(error.message),
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const errors: Record<string, string> = {}
    const jsonFields = [
      'model_mapping',
      'status_code_mapping',
      ...(sensitive ? (['setting', 'settings', 'param_override', 'header_override'] as const) : []),
    ] as const
    for (const key of jsonFields) {
      if (!draft[key]?.trim()) continue
      try {
        const value = JSON.parse(draft[key]!)
        if (!value || typeof value !== 'object' || Array.isArray(value)) errors[key] = 'Invalid JSON object'
      } catch {
        errors[key] = 'Invalid JSON object'
      }
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      setAdvancedOpen(true)
      return
    }
    try {
      save.mutate(channelRequest(draft, sensitive))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid JSON object')
    }
  }
  const patch = (value: Partial<ChannelDraft>) => {
    setDraft((current) => ({ ...current, ...value }))
    setFieldErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !Object.hasOwn(value, key))))
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose()
      }}
    >
      <DialogContent className="admin-editor flex max-h-[88vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t(draft.id ? 'Edit channel' : 'Add channel')}</DialogTitle>
          <DialogDescription>{t('Configure upstream models, routing and credentials.')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !save.isPending) {
              event.preventDefault()
              event.currentTarget.requestSubmit()
            }
          }}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="admin-form-grid">
              <label className="field">
                <span>{t('Name')}</span>
                <input autoFocus required value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Type')}</span>
                <select
                  value={draft.type}
                  disabled={!!draft.id && !sensitive}
                  onChange={(event) => {
                    try {
                      patch(channelProviderTypeChange(draft, Number(event.target.value)))
                      setError('')
                    } catch {
                      setError('Invalid JSON object')
                    }
                  }}
                >
                  {Object.entries(CHANNEL_TYPES).map(([id, name]) => (
                    <option value={id} key={id} disabled={Number(id) === 61 && !pluginBind}>
                      {t(name)}
                    </option>
                  ))}
                </select>
              </label>
              {sensitive && (
                <label className="field admin-wide">
                  <span>Base URL</span>
                  <input
                    type="url"
                    placeholder="https://api.openai.com"
                    value={draft.base_url || ''}
                    onChange={(event) => patch({ base_url: event.target.value })}
                  />
                </label>
              )}
              {!draft.id && (
                <label className="field">
                  <span>{t('Add mode')}</span>
                  <select value={draft.mode} onChange={(event) => patch({ mode: event.target.value })}>
                    <option value="single">{t('Single')}</option>
                    <option value="batch" disabled={draft.type === 57}>
                      {t('Batch')}
                    </option>
                    <option value="multi_to_single" disabled={draft.type === 57}>
                      {t('Multi-key channel')}
                    </option>
                  </select>
                </label>
              )}
              {(draft.mode === 'multi_to_single' || draft.channel_info?.is_multi_key) && (
                <label className="field">
                  <span>{t('Key rotation')}</span>
                  <select value={draft.multi_key_mode} onChange={(event) => patch({ multi_key_mode: event.target.value })}>
                    <option value="random">{t('Random')}</option>
                    <option value="polling">{t('Round robin')}</option>
                  </select>
                </label>
              )}
              {sensitive && (
                <label className="field admin-wide">
                  <span>{t(draft.id ? 'Replace credentials (leave blank to keep)' : 'API key')}</span>
                  <textarea
                    autoComplete="off"
                    spellCheck={false}
                    required={
                      !draft.id && draft.type !== 4 && draft.type !== 62 && draft.type !== 63 && !(draft.type === 61 && draft.mode === 'single')
                    }
                    value={draft.key || ''}
                    rows={3}
                    onChange={(event) => patch({ key: event.target.value })}
                  />
                </label>
              )}
              {sensitive && draft.channel_info?.is_multi_key && (
                <label className="field">
                  <span>{t('Key update mode')}</span>
                  <select value={draft.key_mode} onChange={(event) => patch({ key_mode: event.target.value })}>
                    <option value="append">{t('Append')}</option>
                    <option value="replace">{t('Replace')}</option>
                  </select>
                </label>
              )}
              {sensitive && pluginBind && <ChannelPluginFields draft={draft} ownerId={ownerId} patch={patch} />}
              {sensitive && <ChannelProviderFields key={draft.type} draft={draft} patch={patch} />}
              {sensitive && <AdvancedChannelFields draft={draft} patch={patch} />}
              <label className="field admin-wide">
                <span>{t('Models')}</span>
                <textarea
                  required
                  rows={3}
                  placeholder="gpt-4o-mini,claude-sonnet"
                  value={draft.models}
                  onChange={(event) => patch({ models: event.target.value })}
                />
              </label>
              <div className="admin-wide">
                <PrefillSelect
                  type="model"
                  onSelect={(models) =>
                    patch({
                      models: [
                        ...new Set(
                          `${draft.models || ''},${models}`
                            .split(/[\n,]/)
                            .map((value) => value.trim())
                            .filter(Boolean)
                        ),
                      ].join(','),
                    })
                  }
                />
              </div>
              <label className="field">
                <span>{t('Group')}</span>
                <input required value={draft.group} onChange={(event) => patch({ group: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Tag')}</span>
                <input value={draft.tag || ''} onChange={(event) => patch({ tag: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Priority')}</span>
                <input type="number" step="1" value={draft.priority ?? 0} onChange={(event) => patch({ priority: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>{t('Weight')}</span>
                <input type="number" min="0" step="1" value={draft.weight ?? 0} onChange={(event) => patch({ weight: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>{t('Test model')}</span>
                <input value={draft.test_model || ''} onChange={(event) => patch({ test_model: event.target.value })} />
              </label>
              <label className="field">
                <span>{t('Remark')}</span>
                <input maxLength={255} value={draft.remark || ''} onChange={(event) => patch({ remark: event.target.value })} />
              </label>
              <label className="checkbox-label admin-wide">
                <input type="checkbox" checked={draft.auto_ban === 1} onChange={(event) => patch({ auto_ban: event.target.checked ? 1 : 0 })} />
                {t('Automatic disable')}
              </label>
              {sensitive && <ChannelCommonFields draft={draft} patch={patch} />}
            </div>
            <details className="admin-advanced" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
              <summary>{t('Advanced settings')}</summary>
              {(
                [
                  'model_mapping',
                  'status_code_mapping',
                  ...(sensitive ? (['setting', 'settings', 'param_override', 'header_override'] as const) : []),
                ] as const
              ).map((key) => (
                <label className="field" key={key}>
                  <span>
                    {t(
                      {
                        model_mapping: 'Model mapping',
                        status_code_mapping: 'Status code mapping',
                        setting: 'Channel settings',
                        settings: 'Provider settings',
                        param_override: 'Parameter override',
                        header_override: 'Header override',
                      }[key]
                    )}{' '}
                    · JSON
                  </span>
                  <textarea
                    id={`channel-${key}`}
                    aria-invalid={!!fieldErrors[key]}
                    aria-describedby={fieldErrors[key] ? `channel-${key}-error` : undefined}
                    spellCheck={false}
                    rows={4}
                    value={draft[key] || ''}
                    onChange={(event) => patch({ [key]: event.target.value })}
                  />
                  {fieldErrors[key] && (
                    <span id={`channel-${key}-error`} role="alert" className="inline-error">
                      {t(fieldErrors[key])}
                    </span>
                  )}
                </label>
              ))}
              {sensitive && (
                <>
                  <label className="field">
                    <span>OpenAI organization</span>
                    <input value={draft.openai_organization || ''} onChange={(event) => patch({ openai_organization: event.target.value })} />
                  </label>
                  {![3, 18, 21, 39, 41, 49].includes(draft.type || 0) && (
                    <label className="field">
                      <span>{t('Other')}</span>
                      <input value={draft.other || ''} onChange={(event) => patch({ other: event.target.value })} />
                    </label>
                  )}
                </>
              )}
            </details>
            {error && (
              <p role="alert" className="inline-error">
                {t(error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
