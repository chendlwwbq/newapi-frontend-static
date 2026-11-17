'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Wallet, Shield, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import type { PageResult } from '@/lib/api/types'
import { useQuotaFormatter } from '@/lib/format'
import { quotaInput, type QuotaStatus } from '@/features/tokens/token-form'
import { Button } from '@/components/ui/button'
import { ProgressIndicator } from '@/components/ui/progress-indicator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ErrorState, EmptyState, LoadingState } from '@/components/shared/states'
import { SecurityDialog } from '@/features/auth/secure-verification/security-dialog'
import type { VerificationOperation, AdminUserManageAction } from '@/features/auth/secure-verification/types'
import { AdminSearch, AdminPagination } from './shared'
import { UserEditor, type UserForm } from './user-editor'
import { UserBindings } from './user-bindings'
import type { AdminUser } from './types'

interface PendingAction {
  title: string
  username: string
  operation: VerificationOperation
  path: string
  method: string
  body?: unknown
}
export function UsersPage() {
  const { t } = useTranslation(),
    { bundle } = useAuth(),
    queries = useQueryClient(),
    format = useQuotaFormatter(),
    root = bundle?.user.role === 100
  const [page, setPage] = useState(1),
    [keyword, setKeyword] = useState(''),
    [status, setStatus] = useState(''),
    [role, setRole] = useState('')
  const [filters, setFilters] = useState({ status: '', role: '' }),
    [editor, setEditor] = useState<{ user: AdminUser | null } | null>(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState<PendingAction | null>(null)
  const [managing, setManaging] = useState<AdminUser | null>(null),
    [quotaUser, setQuotaUser] = useState<AdminUser | null>(null),
    [mode, setMode] = useState('add'),
    [amount, setAmount] = useState('')
  const [bindingUser, setBindingUser] = useState<AdminUser | null>(null)
  const query = useQuery({
    queryKey: ['admin-users', bundle?.user.id, page, keyword, filters],
    queryFn: ({ signal }) =>
      api<PageResult<AdminUser>>(
        `/api/user/search?p=${page}&page_size=20&keyword=${encodeURIComponent(keyword)}&status=${filters.status}&role=${filters.role}`,
        { signal }
      ),
  })
  const statusQuery = useQuery({ queryKey: ['status'], queryFn: () => api<QuotaStatus>('/api/status') })
  const adjustment = statusQuery.data?.quota_per_unit ? quotaInput(statusQuery.data) : null
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(window.location.search)
      const nextPage = Number(params.get('page')) || 1
      const nextKeyword = params.get('q') || ''
      const nextStatus = params.get('status') || ''
      const nextRole = params.get('role') || ''
      setPage(nextPage > 0 ? nextPage : 1)
      setKeyword(nextKeyword)
      setStatus(nextStatus)
      setRole(nextRole)
      setFilters({ status: nextStatus, role: nextRole })
    }
    restore()
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  function syncUserUrl(nextPage: number, nextKeyword: string, nextStatus: string, nextRole: string) {
    const params = new URLSearchParams()
    if (nextPage > 1) params.set('page', String(nextPage))
    if (nextKeyword) params.set('q', nextKeyword)
    if (nextStatus) params.set('status', nextStatus)
    if (nextRole) params.set('role', nextRole)
    const queryString = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`)
  }
  function changed() {
    void queries.invalidateQueries({ queryKey: ['admin-users'] })
    void queries.invalidateQueries({ queryKey: ['self'] })
    toast.success(t('Saved'))
  }
  const save = useMutation({
    gcTime: 0,
    mutationFn: (value: UserForm) => api('/api/user', { method: value.id ? 'PUT' : 'POST', body: value }),
    onSuccess: () => {
      setEditor(null)
      changed()
    },
    onError: (error) => setError(error.message),
  })
  const quotaTargetId = useRef<number | null>(null)
  const quota = useMutation({
    mutationFn: (body: { id: number; action: string; mode: string; value: number }) => api('/api/user/manage', { method: 'POST', body }),
    onSuccess: (_result, body) => {
      if (quotaTargetId.current === body.id) {
        quotaTargetId.current = null
        setQuotaUser(null)
        setAmount('')
      }
      changed()
    },
    onError: (error, body) => {
      if (quotaTargetId.current === body.id) setError(error.message)
    },
  })
  const latestEditRequest = useRef(0)
  useEffect(
    () => () => {
      latestEditRequest.current++
    },
    []
  )
  async function edit(user: AdminUser) {
    const requestId = ++latestEditRequest.current
    try {
      const detail = await api<AdminUser>(`/api/user/${user.id}`)
      if (requestId !== latestEditRequest.current) return
      setError('')
      setEditor({ user: detail })
    } catch (error) {
      if (requestId === latestEditRequest.current) toast.error(t((error as Error).message))
    }
  }
  function submitUser(value: UserForm) {
    setError('')
    if (value.id && (value.password || value.admin_permissions))
      setPending({
        title: 'Edit user',
        username: value.username,
        operation: { scope: 'admin.user.update', context: { user_id: value.id } },
        path: '/api/user',
        method: 'PUT',
        body: value,
      })
    else if (!value.id && value.role >= 10)
      setPending({
        title: 'Add user',
        username: value.username,
        operation: { scope: 'admin.user.create', context: { role: value.role } },
        path: '/api/user',
        method: 'POST',
        body: value,
      })
    else save.mutate(value)
  }
  function manage(action: AdminUserManageAction | 'delete' | 'passkey' | '2fa') {
    if (!managing) return
    const user = managing,
      context = { user_id: user.id }
    if (action === 'passkey' || action === '2fa')
      setPending({
        title: action === 'passkey' ? 'Reset passkey' : 'Disable two-factor authentication',
        username: user.username,
        operation: { scope: action === 'passkey' ? 'admin.user.passkey.reset' : 'admin.user.2fa.disable', context },
        path: `/api/user/${user.id}/${action === 'passkey' ? 'reset_passkey' : '2fa'}`,
        method: 'DELETE',
      })
    else if (action === 'delete')
      setPending({
        title: 'Delete user',
        username: user.username,
        operation: { scope: 'admin.user.delete', context },
        path: `/api/user/${user.id}`,
        method: 'DELETE',
      })
    else
      setPending({
        title: { enable: 'Enable', disable: 'Disable', promote: 'Promote to administrator', demote: 'Demote to user' }[action],
        username: user.username,
        operation: { scope: 'admin.user.manage', context: { ...context, action } },
        path: '/api/user/manage',
        method: 'POST',
        body: { id: user.id, action },
      })
    setManaging(null)
  }
  function submitQuota(event: FormEvent) {
    event.preventDefault()
    if (!quotaUser || !adjustment || quota.isPending) return
    setError('')
    try {
      if (!amount.trim()) throw new Error('Invalid parameters')
      const value = adjustment.toQuota(Number(amount))
      if (value === 0 && mode !== 'override') throw new Error('Invalid parameters')
      quota.mutate({ id: quotaUser.id, action: 'add_quota', mode, value })
    } catch (error) {
      setError((error as Error).message)
    }
  }
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>{t('Users')}</h1>
          <p>{t('Manage account details and administrative access.')}</p>
        </div>
        <div className="action-buttons">
          <Button variant="outline" aria-label={t('Refresh')} onClick={() => query.refetch()}>
            <RefreshCw size={14} />
          </Button>
          <Button
            onClick={() => {
              latestEditRequest.current++
              setError('')
              setEditor({ user: null })
            }}
          >
            <Plus size={14} />
            {t('Add user')}
          </Button>
        </div>
      </div>
      <AdminSearch
        initialValue={keyword}
        onSearch={(value) => {
          setPage(1)
          setKeyword(value)
          setFilters({ status, role })
          syncUserUrl(1, value, status, role)
        }}
      >
        <select className="plain-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t('Status')}>
          <option value="">{t('All statuses')}</option>
          <option value="1">{t('Enabled')}</option>
          <option value="2">{t('Disabled')}</option>
          <option value="-1">{t('Deleted')}</option>
        </select>
        <select className="plain-select" value={role} onChange={(event) => setRole(event.target.value)} aria-label={t('Role')}>
          <option value="">{t('All roles')}</option>
          <option value="1">{t('User')}</option>
          <option value="10">{t('Administrator')}</option>
          <option value="100">{t('Super administrator')}</option>
        </select>
      </AdminSearch>
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Username', 'Role', 'Status', 'Group', 'Account balance', 'Total usage', 'Requests', 'Actions'].map((label) => (
                    <th
                      key={label}
                      className={
                        label === 'Actions'
                          ? 'table-sticky-action'
                          : ['Account balance', 'Total usage', 'Requests'].includes(label)
                            ? 'text-right'
                            : undefined
                      }
                    >
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((user) => {
                  const manageable = !user.DeletedAt && (root || (bundle?.user.role || 0) > user.role)
                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.display_name || user.username}</strong>
                        <div className="small-note">
                          #{user.id} · {user.username}
                        </div>
                      </td>
                      <td>{t(user.role === 100 ? 'Super administrator' : user.role >= 10 ? 'Administrator' : 'User')}</td>
                      <td>
                        <span className={`status-badge ${!user.DeletedAt && user.status === 1 ? 'success' : ''}`}>
                          {t(user.DeletedAt ? 'Deleted' : user.status === 1 ? 'Enabled' : 'Disabled')}
                        </span>
                      </td>
                      <td>{user.group}</td>
                      <td className="text-right tabular-nums font-mono">{format(user.quota)}</td>
                      <td className="text-right">
                        <div className="ml-auto min-w-[110px] space-y-1.5">
                          <span className="tabular-nums font-mono">{format(user.used_quota)}</span>
                          <ProgressIndicator
                            value={user.used_quota}
                            max={Math.max(user.quota + user.used_quota, 1)}
                            showPercentage={false}
                            size="sm"
                          />
                        </div>
                      </td>
                      <td className="text-right tabular-nums font-mono">{user.request_count}</td>
                      <td className="table-sticky-action">
                        {manageable && (
                          <div className="action-buttons">
                            <Button variant="ghost" size="icon" aria-label={`${t('Edit')} ${user.username}`} onClick={() => edit(user)}>
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${t('Adjust quota')} ${user.username}`}
                              disabled={quota.isPending}
                              onClick={() => {
                                setError('')
                                quotaTargetId.current = user.id
                                setQuotaUser(user)
                                setMode('add')
                                setAmount('')
                              }}
                            >
                              <Wallet size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`${t('Manage user')} ${user.username}`} onClick={() => setManaging(user)}>
                              <Shield size={14} />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!query.data.items.length && <EmptyState />}
          <AdminPagination
            page={page}
            total={query.data.total}
            onPage={(nextPage) => {
              setPage(nextPage)
              syncUserUrl(nextPage, keyword, filters.status, filters.role)
            }}
          />
        </>
      )}
      {editor && (
        <UserEditor
          key={editor.user?.id ?? 'new'}
          initial={editor.user}
          root={root}
          busy={save.isPending}
          error={error}
          onSubmit={submitUser}
          onClose={() => {
            latestEditRequest.current++
            setEditor(null)
          }}
        />
      )}
      {bindingUser && <UserBindings key={`${bundle?.session.sid}:${bindingUser.id}`} user={bindingUser} onClose={() => setBindingUser(null)} />}
      <Dialog
        open={!!managing}
        onOpenChange={(open) => {
          if (!open) setManaging(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('Manage user')} · {managing?.username}
            </DialogTitle>
            <DialogDescription>{t('Sensitive changes require identity verification.')}</DialogDescription>
          </DialogHeader>
          {managing && (
            <div className="admin-action-list">
              {managing.role !== 100 && (
                <>
                  <Button variant="outline" onClick={() => manage(managing.status === 1 ? 'disable' : 'enable')}>
                    {t(managing.status === 1 ? 'Disable' : 'Enable')}
                  </Button>
                  {root && (
                    <Button variant="outline" onClick={() => manage(managing.role >= 10 ? 'demote' : 'promote')}>
                      {t(managing.role >= 10 ? 'Demote to user' : 'Promote to administrator')}
                    </Button>
                  )}
                </>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setBindingUser(managing)
                  setManaging(null)
                }}
              >
                {t('Account Binding Management')}
              </Button>
              <Button variant="outline" onClick={() => manage('passkey')}>
                {t('Reset passkey')}
              </Button>
              <Button variant="outline" onClick={() => manage('2fa')}>
                {t('Disable two-factor authentication')}
              </Button>
              {managing.role !== 100 && (
                <Button variant="destructive" onClick={() => manage('delete')}>
                  {t('Delete user')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!quotaUser}
        onOpenChange={(open) => {
          if (!open && !quota.isPending) {
            quotaTargetId.current = null
            setQuotaUser(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('Adjust quota')} · {quotaUser?.username}
            </DialogTitle>
            <DialogDescription>
              {t('Account balance')}: {quotaUser && format(quotaUser.quota)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitQuota}>
            <label className="field">
              <span>{t('Adjustment mode')}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="add">{t('Add')}</option>
                <option value="subtract">{t('Subtract')}</option>
                <option value="override">{t('Set balance')}</option>
              </select>
            </label>
            <label className="field">
              <span>
                {t('Amount')}
                {adjustment && ` (${adjustment.label})`}
              </span>
              <input
                required
                type="number"
                min={mode === 'override' ? 0 : 0.000001}
                step="0.000001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            {error && (
              <p className="inline-error" role="alert">
                {t(error)}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={quota.isPending}
                onClick={() => {
                  quotaTargetId.current = null
                  setQuotaUser(null)
                }}
              >
                {t('Cancel')}
              </Button>
              <Button type="submit" loading={quota.isPending} disabled={!adjustment}>
                {t('Confirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {pending && (
        <SecurityDialog
          title={`${t(pending.title)} · ${pending.username}`}
          operation={pending.operation}
          onClose={() => setPending(null)}
          onAuthorized={async (proof, signal) => {
            await api(pending.path, { method: pending.method, body: pending.body, headers: { 'X-Security-Proof': proof }, signal })
            setEditor(null)
            changed()
          }}
        />
      )}
    </>
  )
}
