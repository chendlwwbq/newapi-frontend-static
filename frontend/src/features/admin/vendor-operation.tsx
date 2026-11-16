'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/shared/states'
import type { VendorMetadata } from './metadata-types'
import { AdminPagination, AdminSearch } from './shared'

export type VendorOperationInput = { action: 'assign' | 'merge' | 'delete'; vendor_ids?: number[]; model_ids?: number[] }
interface Preview {
  sources: VendorMetadata[]
  target: VendorMetadata | null
  version: string
  models: { id: number; model_name: string; vendor_name: string; vendor_id: number; name_rule: number }[]
}
export function VendorOperation({ input, onClose, onSaved }: { input: VendorOperationInput; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient()
  const [target, setTarget] = useState(0),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [review, setReview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [result, setResult] = useState<{ updated_models: number[]; deleted_vendors: number[] } | null>(null)
  const vendors = useQuery({
    queryKey: ['admin-vendor-picker', bundle?.user.id, page, search],
    enabled: input.action !== 'delete' && !review && !result,
    queryFn: ({ signal }) =>
      api<PageResult<VendorMetadata>>(`/api/vendors/search?${new URLSearchParams({ keyword: search, p: String(page), page_size: '20' })}`, {
        signal,
      }),
  })
  async function preview() {
    setBusy(true)
    setError('')
    try {
      setReview(await api<Preview>('/api/vendors/operations/preview', { method: 'POST', body: { ...input, target_vendor_id: target } }))
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function apply() {
    if (!review) return
    setBusy(true)
    setError('')
    try {
      setResult(
        await api('/api/vendors/operations', { method: 'POST', body: { ...input, target_vendor_id: target, expected_version: review.version } })
      )
      setReview(null)
      for (const key of ['admin-vendors', 'admin-vendor-options', 'admin-vendor-picker', 'admin-models', 'catalog'])
        void queries.invalidateQueries({ queryKey: [key] })
      onSaved()
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'VENDOR_CONFLICT') {
        setReview(null)
        setError('Vendor data changed. Preview again before applying.')
      } else setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="admin-editor">
        <DialogHeader>
          <DialogTitle>{t(input.action === 'assign' ? 'Assign vendor' : input.action === 'merge' ? 'Merge vendors' : 'Delete vendors')}</DialogTitle>
          <DialogDescription>{t('Review the affected models before applying vendor changes.')}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div role="status">
            <p>
              {t('Updated models')}: {result.updated_models.length}
            </p>
            <p>
              {t('Deleted vendors')}: {result.deleted_vendors.length}
            </p>
            <Button onClick={onClose}>{t('Close')}</Button>
          </div>
        ) : (
          <>
            {!review && input.action !== 'delete' && (
              <>
                <AdminSearch
                  onSearch={(value) => {
                    setSearch(value)
                    setPage(1)
                  }}
                />
                {vendors.error ? (
                  <ErrorState error={vendors.error} retry={() => vendors.refetch()} />
                ) : vendors.isPending ? (
                  <LoadingState />
                ) : (
                  <>
                    <label className="field">
                      {t('Target vendor')}
                      <select disabled={busy} value={target} onChange={(event) => setTarget(Number(event.target.value))}>
                        <option value={0}>{t(input.action === 'assign' ? 'Clear vendor assignment' : 'Select a saved vendor.')}</option>
                        {target > 0 && !vendors.data.items.some((vendor) => vendor.id === target) && <option value={target}>#{target}</option>}
                        {vendors.data.items
                          .filter((vendor) => !input.vendor_ids?.includes(vendor.id))
                          .map((vendor) => (
                            <option value={vendor.id} key={vendor.id}>
                              {vendor.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <AdminPagination page={page} total={vendors.data.total} onPage={setPage} />
                  </>
                )}
              </>
            )}
            {!review && (
              <p className="small-note">
                {t('Selected records')}: {input.model_ids?.length || input.vendor_ids?.length || 0}
              </p>
            )}
            {review && (
              <div className="vendor-review">
                <p>
                  {t('Source vendors')}: {review.sources.map((vendor) => vendor.name).join(', ') || '—'}
                </p>
                <p>
                  {t('Target vendor')}: {review.target?.name || t('None')}
                </p>
                <p className="small-note">
                  {t(
                    input.action === 'merge'
                      ? 'Source vendors will be deleted after their models are transferred.'
                      : 'Only the reviewed records will be changed.'
                  )}
                </p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('Model name')}</th>
                        <th>{t('Current vendor')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {review.models.map((model) => (
                        <tr key={model.id}>
                          <td>{model.model_name}</td>
                          <td>{model.vendor_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  {t('Affected models')}: {review.models.length}
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="inline-error">
                {t(error)}
              </p>
            )}
            <div className="action-buttons">
              <Button disabled={busy} variant="outline" onClick={() => (review ? setReview(null) : onClose())}>
                {t(review ? 'Back' : 'Cancel')}
              </Button>
              <Button disabled={busy || (!review && input.action === 'merge' && target === 0)} onClick={review ? apply : preview}>
                {t(busy ? 'Loading' : review ? 'Apply changes' : 'Preview')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
