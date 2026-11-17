'use client'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth/session'
import type { User } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/states'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

export function AdminGate({ children }: { children: ReactNode }) {
  const { bundle } = useAuth(),
    { t } = useTranslation()
  return bundle && bundle.user.role >= 10 ? children : <EmptyState title={t('Unauthorized, insufficient privileges')} />
}
export function canChannel(user: User | undefined, action: string) {
  return user?.role === 100 || user?.permissions?.admin_permissions?.channel?.[action] === true
}
export function AdminSearch({ onSearch, children }: { onSearch: (keyword: string) => void; children?: ReactNode }) {
  const [keyword, setKeyword] = useState(''),
    { t } = useTranslation()
  function submit(event: FormEvent) {
    event.preventDefault()
    onSearch(keyword.trim())
  }
  return (
    <form className="console-toolbar admin-toolbar" onSubmit={submit}>
      <label className="search-field">
        <Search size={15} />
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} aria-label={t('Search')} placeholder={t('Search')} />
      </label>
      {children}
      <Button type="submit" variant="outline">
        {t('Search')}
      </Button>
    </form>
  )
}
export function AdminPagination({
  page,
  total,
  onPage,
  pageSize = 20,
}: {
  page: number
  total: number
  onPage: (page: number) => void
  pageSize?: number
}) {
  const { t } = useTranslation()
  return (
    <div className="table-footer">
      <span>
        {total} {t('Total')}
      </span>
      <div>
        <Button size="icon" variant="outline" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label={t('Previous')}>
          <ChevronLeft size={15} />
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <Button size="icon" variant="outline" disabled={page * pageSize >= total} onClick={() => onPage(page + 1)} aria-label={t('Next')}>
          <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  )
}
export function AdminConfirm({
  title,
  description,
  busy,
  onConfirm,
  onClose,
  error,
}: {
  title: string
  description: string
  busy: boolean
  onConfirm: () => void
  onClose: () => void
  error?: Error | null
}) {
  const { t } = useTranslation()
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="inline-error">
            {t(error.message)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('Cancel')}</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>
            {t(busy ? 'Loading' : 'Confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
