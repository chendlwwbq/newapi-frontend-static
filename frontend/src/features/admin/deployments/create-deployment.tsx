'use client'
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { DeploymentQuote } from './deployment-quote'
import { ContainerFields } from './container-fields'
import { deploymentCostParameters, deploymentCreatePayload } from './contracts'
import { blankCreate, type CreateDraft, type Hardware, type Replica, type DeploymentCost } from './types'
export function CreateDeployment(props: { onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation(),
    { bundle } = useAuth(),
    locale = toIntlLocale(i18n.language)
  const [draft, setDraft] = useState<CreateDraft>(() => ({ ...blankCreate })),
    [error, setError] = useState(''),
    [quote, setQuote] = useState<{ key: string; cost: DeploymentCost } | null>(null),
    [review, setReview] = useState(false),
    [checking, setChecking] = useState(false),
    [availability, setAvailability] = useState<{ name: string; available: boolean } | null>(null)
  const hardware = useQuery({
    queryKey: ['deployment-hardware', bundle?.user.id],
    queryFn: ({ signal }) => api<{ hardware_types: Hardware[] }>('/api/deployments/hardware-types', { signal }),
  })
  const chosenHardware = hardware.data?.hardware_types.find((row) => String(row.id) === draft.hardware)
  const replicas = useQuery({
    queryKey: ['deployment-replicas', bundle?.user.id, draft.hardware, draft.gpus],
    enabled: !!draft.hardware && Number(draft.gpus) > 0,
    queryFn: ({ signal }) =>
      api<{ replicas: Replica[] }>(
        `/api/deployments/available-replicas?${new URLSearchParams({ hardware_id: draft.hardware, gpu_count: draft.gpus })}`,
        { signal }
      ),
  })
  const locations = Array.from(new Map((replicas.data?.replicas || []).map((row) => [row.location_id, row])).values())
  let quoteKey = ''
  try {
    quoteKey = JSON.stringify(deploymentCostParameters(draft))
  } catch {
    /* Incomplete resource selections do not request an estimate. */
  }
  const validQuote = quote?.key === quoteKey && quote.cost.estimation_valid
  const estimate = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const params = deploymentCostParameters(draft)
      return { key: JSON.stringify(params), cost: await api<DeploymentCost>('/api/deployments/price-estimation', { method: 'POST', body: params }) }
    },
    onSuccess: (value) => setQuote(value),
    onError: (error) => setError(error.message),
  })
  const save = useMutation({
    gcTime: 0,
    mutationFn: () => api('/api/deployments/', { method: 'POST', body: deploymentCreatePayload(draft) }),
    onSuccess: props.onSaved,
    onError: (error) => {
      setError(error.message)
      setReview(false)
    },
  })
  function patch(value: Partial<CreateDraft>) {
    setDraft((previous) => ({ ...previous, ...value }))
    setReview(false)
  }
  async function checkName() {
    setChecking(true)
    setError('')
    try {
      setAvailability(
        await api<{ name: string; available: boolean }>(`/api/deployments/check-name?${new URLSearchParams({ name: draft.name.trim() })}`)
      )
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setChecking(false)
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      deploymentCreatePayload(draft)
      if (!validQuote) throw new Error('Estimate the current resource selection before continuing')
      if (!review) {
        setReview(true)
        return
      }
      save.mutate()
    } catch (error) {
      setError((error as Error).message)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) props.onClose()
      }}
    >
      <DialogContent className="deployment-dialog flex max-h-[88vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t(review ? 'Review deployment' : 'Create deployment')}</DialogTitle>
          <DialogDescription>{t('Resources are provisioned by io.net and may incur provider charges.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} autoComplete="off" className="min-h-0 flex-1 overflow-y-auto pr-1">
          <fieldset disabled={save.isPending}>
            {review ? (
              <div className="deployment-review">
                <h3>{draft.name}</h3>
                <p>{draft.image}</p>
                <dl>
                  <dt>{t('Hardware')}</dt>
                  <dd>{chosenHardware?.name}</dd>
                  <dt>{t('GPUs per container')}</dt>
                  <dd>{draft.gpus}</dd>
                  <dt>{t('Replicas')}</dt>
                  <dd>{draft.replicas}</dd>
                  <dt>{t('Duration (hours)')}</dt>
                  <dd>{draft.duration}</dd>
                  <dt>{t('Locations')}</dt>
                  <dd>
                    {locations
                      .filter((row) => draft.locations.includes(row.location_id))
                      .map((row) => row.location_name)
                      .join(', ')}
                  </dd>
                </dl>
                {quote && <DeploymentQuote cost={quote.cost} />}
                <Button type="button" variant="outline" onClick={() => setReview(false)}>
                  {t('Edit')}
                </Button>
              </div>
            ) : (
              <>
                <div className="admin-form-grid">
                  <label className="field admin-wide">
                    <span>{t('Deployment name')}</span>
                    <Input required value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
                  </label>
                  <div className="action-buttons admin-wide">
                    <Button type="button" variant="outline" disabled={!draft.name.trim() || checking} onClick={checkName}>
                      {t('Check name availability')}
                    </Button>
                    {availability?.name === draft.name.trim() && <span>{t(availability.available ? 'Available' : 'Unavailable')}</span>}
                  </div>
                  <label className="field">
                    <span>{t('Hardware')}</span>
                    <select required value={draft.hardware} onChange={(event) => patch({ hardware: event.target.value, gpus: '1', locations: [] })}>
                      <option value="">{t('Select')}</option>
                      {hardware.data?.hardware_types.map((row) => (
                        <option value={row.id} key={row.id} disabled={!row.available}>
                          {row.brand_name} {row.name} · {formatNumber(row.available_count, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t('GPUs per container')}</span>
                    <Input
                      required
                      type="number"
                      min={1}
                      max={chosenHardware?.max_gpus}
                      step={1}
                      value={draft.gpus}
                      onChange={(event) => patch({ gpus: event.target.value, locations: [] })}
                    />
                  </label>
                  {(['replicas', 'duration'] as const).map((key) => (
                    <label className="field" key={key}>
                      <span>{t(key === 'replicas' ? 'Replicas' : 'Duration (hours)')}</span>
                      <Input type="number" min={1} step={1} required value={draft[key]} onChange={(event) => patch({ [key]: event.target.value })} />
                    </label>
                  ))}
                  <label className="field">
                    <span>{t('Quote currency')}</span>
                    <Input required value={draft.currency} onChange={(event) => patch({ currency: event.target.value })} />
                  </label>
                  <div className="field admin-wide">
                    <span>{t('Locations')}</span>
                    {locations.map((row) => (
                      <label key={row.location_id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={draft.locations.includes(row.location_id)}
                          onChange={(event) =>
                            patch({
                              locations: event.target.checked
                                ? [...draft.locations, row.location_id]
                                : draft.locations.filter((id) => id !== row.location_id),
                            })
                          }
                        />
                        {row.location_name} · {formatNumber(row.available_count, locale)} {t('Available')}
                      </label>
                    ))}
                    {!locations.length && <small>{t('Select hardware to load available locations')}</small>}
                  </div>
                </div>
                {hardware.isPending && <LoadingState />}
                {hardware.error && <ErrorState error={hardware.error} retry={() => hardware.refetch()} />}{' '}
                {replicas.error && <ErrorState error={replicas.error} retry={() => replicas.refetch()} />}
                <ContainerFields value={draft} onChange={patch} />
                <div className="deployment-quote">
                  <Button
                    type="button"
                    variant="outline"
                    loading={estimate.isPending}
                    disabled={!quoteKey}
                    onClick={() => {
                      setError('')
                      estimate.mutate()
                    }}
                  >
                    {t('Estimate cost')}
                  </Button>
                  {validQuote && quote && <DeploymentQuote cost={quote.cost} />}
                  {quote?.key === quoteKey && !quote.cost.estimation_valid && (
                    <span role="alert">{t('The provider returned an invalid estimate')}</span>
                  )}
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="inline-error">
                {t(error)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={props.onClose}>
                {t('Cancel')}
              </Button>
              <Button type="submit" loading={save.isPending} disabled={!validQuote}>
                {t(review ? 'Create deployment' : 'Review deployment')}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
