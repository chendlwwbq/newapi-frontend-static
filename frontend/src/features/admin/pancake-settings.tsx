'use client'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState } from '@/components/shared/states'
import { AdminConfirm } from './shared'
import { isRecord, validateSettingsUrl } from './lib/settings-collections'

interface Store {
  id: string
  name: string
  status: string
  prodEnabled: boolean
  onetimeProducts: { id: string; name: string; status: string }[]
}
interface Pair {
  store_id: string
  product_id: string
  store_name: string
  product_name: string
}
export function PancakeSettings({ initial, disabled }: { initial: Record<string, string>; disabled: boolean }) {
  const { t } = useTranslation(),
    queries = useQueryClient()
  const starting = {
    merchant_id: initial.WaffoPancakeMerchantID || '',
    private_key: '',
    return_url: initial.WaffoPancakeReturnURL || '',
    store_id: initial.WaffoPancakeStoreID || '',
    product_id: initial.WaffoPancakeProductID || '',
  }
  const [baseline, setBaseline] = useState(starting),
    [draft, setDraft] = useState(starting),
    [stores, setStores] = useState<Store[] | null>(null)
  const [busy, setBusy] = useState(false),
    [review, setReview] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [orphan, setOrphan] = useState<string | null>(null)
  const dirty = Object.keys(draft).some((key) => draft[key as keyof typeof draft] !== baseline[key as keyof typeof draft])
  async function catalog() {
    setBusy(true)
    setError(null)
    try {
      setStores((await api<{ stores: Store[] }>('/api/option/waffo-pancake/catalog')).stores)
    } catch (failure) {
      setError(failure as Error)
    } finally {
      setBusy(false)
    }
  }
  async function pair() {
    setBusy(true)
    setError(null)
    try {
      if (draft.return_url) validateSettingsUrl(draft.return_url)
      const storedCredentials = draft.merchant_id === baseline.merchant_id && !draft.private_key
      const result = await api<Pair>('/api/option/waffo-pancake/pair', {
        method: 'POST',
        body: { merchant_id: storedCredentials ? '' : draft.merchant_id, private_key: draft.private_key, return_url: draft.return_url },
      })
      setDraft((previous) => ({ ...previous, store_id: result.store_id, product_id: result.product_id }))
      setReview(false)
      toast.success(t('Created. Save the selected binding to apply it.'))
    } catch (failure) {
      if (failure instanceof ApiError && isRecord(failure.data)) {
        if (failure.data.orphan_store) {
          setOrphan(String(failure.data.store_id || failure.data.store_name || ''))
          setReview(false)
        }
        setError(new Error(typeof failure.data.error === 'string' ? failure.data.error : failure.message))
      } else setError(failure as Error)
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (!draft.merchant_id.trim() || !draft.store_id.trim() || !draft.product_id.trim()) throw new Error('Merchant, store and product are required')
      if (draft.return_url) validateSettingsUrl(draft.return_url)
      await api('/api/option/waffo-pancake/save', { method: 'POST', body: draft })
      const saved = { ...draft, private_key: '' }
      setBaseline(saved)
      setDraft(saved)
      for (const key of ['system-options', 'wallet', 'topup-info', 'status']) void queries.invalidateQueries({ queryKey: [key] })
      toast.success(t('Saved'))
    } catch (failure) {
      setError(failure as Error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="settings-pancake">
      <h2>Waffo Pancake</h2>
      <p className="small-note">
        {t('Catalog lookup uses stored credentials. Saving a binding does not verify merchant ownership or make a payment.')}
      </p>
      {error && <ErrorState error={error} />}
      {orphan !== null && (
        <p role="alert" className="settings-inline-error">
          {t('A store was created but product creation failed. Review this store before creating another pair.')}: <code>{orphan}</code>
        </p>
      )}
      <fieldset className="settings-collection-grid" disabled={disabled || busy}>
        <label>
          {t('Merchant ID')}
          <Input value={draft.merchant_id} onChange={(event) => setDraft((previous) => ({ ...previous, merchant_id: event.target.value }))} />
        </label>
        <label>
          {t('Return URL')}
          <Input value={draft.return_url} onChange={(event) => setDraft((previous) => ({ ...previous, return_url: event.target.value }))} />
        </label>
        <label className="settings-wide">
          {t('Private key')}
          <Textarea
            autoComplete="off"
            value={draft.private_key}
            onChange={(event) => setDraft((previous) => ({ ...previous, private_key: event.target.value }))}
          />
          <small className="small-note">{t('Leave blank to keep the stored value.')}</small>
        </label>
        <label>
          {t('Store ID')}
          <Input value={draft.store_id} onChange={(event) => setDraft((previous) => ({ ...previous, store_id: event.target.value }))} />
        </label>
        <label>
          {t('Product ID')}
          <Input value={draft.product_id} onChange={(event) => setDraft((previous) => ({ ...previous, product_id: event.target.value }))} />
        </label>
        <div className="settings-wide settings-collection-toolbar">
          <Button type="button" variant="outline" onClick={catalog}>
            {t('Load stored catalog')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              orphan !== null || (draft.merchant_id !== baseline.merchant_id && !draft.private_key) || (!draft.merchant_id && !!draft.private_key)
            }
            onClick={() => setReview(true)}
          >
            {t('Create store and product')}
          </Button>
          <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDraft(baseline)}>
            {t('Reset')}
          </Button>
          <Button type="button" disabled={!dirty} onClick={save}>
            {t('Save')}
          </Button>
        </div>
        {stores && (
          <div className="settings-wide settings-catalog">
            {stores.length === 0 && <p>{t('No data')}</p>}
            {stores.map((store) => (
              <section key={store.id}>
                <strong>{store.name}</strong>
                <small>
                  {store.id} · {store.status}
                </small>
                {store.onetimeProducts.map((product) => (
                  <Button
                    key={product.id}
                    type="button"
                    variant={draft.store_id === store.id && draft.product_id === product.id ? 'secondary' : 'outline'}
                    onClick={() => setDraft((previous) => ({ ...previous, store_id: store.id, product_id: product.id }))}
                  >
                    {product.name} · {product.id} · {product.status}
                  </Button>
                ))}
              </section>
            ))}
          </div>
        )}
      </fieldset>
      {review && (
        <AdminConfirm
          title={t('Create store and product')}
          description={t('This creates a real remote store and one-time product. The result is not applied until you save the binding.')}
          busy={busy}
          onClose={() => setReview(false)}
          onConfirm={pair}
        />
      )}
    </section>
  )
}
