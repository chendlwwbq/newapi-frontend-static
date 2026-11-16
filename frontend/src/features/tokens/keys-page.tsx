'use client'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Eye, Trash2, Pencil, Power, ChevronLeft, ChevronRight, ArrowDownUp, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import type { PageResult, Token } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/session'
import { useQuotaFormatter } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { CopyButton } from '@/components/shared/copy-button'
import { MascotMark } from '@/components/motion/mascot'
import { TokenEditor } from './token-editor'
import { SecurityDialog } from '@/features/auth/secure-verification/security-dialog'
import { tokenStatus, type QuotaStatus } from './token-form'

const columns = [
  ['name', 'Name'],
  ['status', 'Status'],
  ['key', 'API keys'],
  ['quota', 'Quota'],
  ['group', 'Group'],
  ['models', 'Models'],
  ['ips', 'IP restrictions'],
  ['created', 'Created'],
  ['accessed', 'Last used'],
  ['expiry', 'Expiry'],
] as const
type Sort = 'name' | 'status' | 'quota' | 'created' | 'accessed' | 'expiry'
export function KeysPage({ create = false, group }: { create?: boolean; group?: string }) {
  const { t, i18n } = useTranslation(),
    queries = useQueryClient(),
    auth = useAuth(),
    money = useQuotaFormatter(),
    userId = auth.bundle?.user.id,
    locale = toIntlLocale(i18n.language)
  const [page, setPage] = useState(1),
    [size, setSize] = useState(20),
    [search, setSearch] = useState(''),
    [keySearch, setKeySearch] = useState(''),
    [applied, setApplied] = useState({ name: '', key: '' }),
    [filter, setFilter] = useState('all')
  const [sort, setSort] = useState<{ key: Sort; direction: number } | null>(null),
    [hidden, setHidden] = useState<string[]>([]),
    [selected, setSelected] = useState<Record<number, Token>>({})
  const [editor, setEditor] = useState<Token | 'new' | null>(create ? 'new' : null),
    [deleting, setDeleting] = useState<number[] | null>(null)
  const [revealed, setRevealed] = useState<{ owner: number | undefined; title: string; keys: string } | null>(null),
    [revealTarget, setRevealTarget] = useState<Token[] | null>(null)
  useEffect(() => {
    setSelected({})
    setRevealed(null)
    setRevealTarget(null)
    setPage(1)
  }, [userId])
  const params = new URLSearchParams({ p: String(page), page_size: String(size) })
  if (applied.name) params.set('keyword', applied.name)
  if (applied.key) params.set('token', applied.key)
  const searching = !!(applied.name || applied.key)
  const query = useQuery({
    queryKey: ['tokens', userId, page, size, applied],
    queryFn: () => api<PageResult<Token>>(`/api/token/${searching ? 'search' : ''}?${params}`),
    enabled: !!userId,
  })
  const status = useQuery({ queryKey: ['status'], queryFn: () => api<QuotaStatus>('/api/status') })
  function changed() {
    void queries.invalidateQueries({ queryKey: ['tokens'] })
  }
  const remove = useMutation({
    mutationFn: (ids: number[]) => api<number>('/api/token/batch', { method: 'POST', body: { ids } }),
    onSuccess: (count) => {
      setDeleting(null)
      setSelected({})
      changed()
      toast.success(t('Deleted {{count}} keys', { count }))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  const toggle = useMutation({
    mutationFn: (token: Token) => api('/api/token/?status_only=true', { method: 'PUT', body: { id: token.id, status: token.status === 1 ? 2 : 1 } }),
    onSuccess: () => {
      changed()
      toast.success(t('Saved'))
    },
    onError: (error) => toast.error(t(error.message)),
  })
  async function reveal(tokens: Token[], proof: string, signal: AbortSignal) {
    const result = await api<{ keys: Record<string, string> }>('/api/token/batch/keys', {
      method: 'POST',
      headers: { 'X-Security-Proof': proof },
      body: { ids: tokens.map((token) => token.id) },
      signal,
    })
    signal.throwIfAborted()
    const values = tokens.flatMap((token) => (result.keys[token.id] ? [`sk-${result.keys[token.id]}`] : []))
    setRevealed({ owner: userId, title: tokens.length === 1 ? tokens[0].name : t('Selected API keys'), keys: values.join('\n') })
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setApplied({ name: search.trim(), key: keySearch.trim() })
  }
  function select(token: Token, checked: boolean) {
    setSelected((previous) => {
      const next = { ...previous }
      if (checked) {
        if (Object.keys(next).length >= 100) {
          toast.error(t('Select up to 100 keys'))
          return previous
        }
        next[token.id] = token
      } else delete next[token.id]
      return next
    })
  }
  function selectPage(checked: boolean) {
    setSelected((previous) => {
      const next = { ...previous }
      for (const token of rows) {
        if (!checked) delete next[token.id]
        else if (Object.keys(next).length < 100) next[token.id] = token
      }
      return next
    })
  }
  const rows = (query.data?.items ?? []).filter((token) => filter === 'all' || tokenStatus(token) === filter)
  if (sort)
    rows.sort((a, b) => {
      let first: string | number = 0,
        last: string | number = 0
      switch (sort.key) {
        case 'name':
          first = a.name
          last = b.name
          break
        case 'status':
          first = tokenStatus(a)
          last = tokenStatus(b)
          break
        case 'quota':
          first = a.unlimited_quota ? Infinity : a.remain_quota
          last = b.unlimited_quota ? Infinity : b.remain_quota
          break
        case 'created':
          first = a.created_time
          last = b.created_time
          break
        case 'accessed':
          first = a.accessed_time ?? 0
          last = b.accessed_time ?? 0
          break
        case 'expiry':
          first = a.expired_time === -1 ? Infinity : a.expired_time
          last = b.expired_time === -1 ? Infinity : b.expired_time
          break
      }
      if (typeof first === 'string' && typeof last === 'string') return first.localeCompare(last, locale) * sort.direction
      if (first === last) return 0
      return (first < last ? -1 : 1) * sort.direction
    })
  const count = Object.keys(selected).length,
    visible = columns.filter(([key]) => !hidden.includes(key)),
    total = query.data?.total ?? 0,
    pages = Math.max(1, Math.ceil(total / size))
  function date(timestamp?: number) {
    return timestamp && timestamp !== -1 ? new Date(timestamp * 1000).toLocaleString(locale, { hour12: false }) : '—'
  }
  return (
    <div className="keys-page">
      <div className="console-page-heading">
        <div>
          <h1>{t('API keys')}</h1>
          <p>{t('Manage keys for your applications and services.')}</p>
        </div>
        <Button onClick={() => setEditor('new')}>
          <Plus size={14} />
          {t('Create API key')}
        </Button>
      </div>
      <form className="keys-toolbar" onSubmit={submit}>
        <label className="search-field">
          <Search size={14} />
          <input
            type="search"
            name="key-name-filter"
            autoComplete="off"
            placeholder={t('Search by name')}
            aria-label={t('Search by name')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="search-field">
          <input
            type="search"
            name="api-key-filter"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('Search by key')}
            aria-label={t('Search by key')}
            value={keySearch}
            onChange={(e) => setKeySearch(e.target.value)}
          />
        </label>
        <select className="plain-select" aria-label={t('Status (current page)')} value={filter} onChange={(e) => setFilter(e.target.value)}>
          {['all', 'Enabled', 'Disabled', 'Expired', 'Exhausted'].map((value) => (
            <option key={value} value={value}>
              {t(value === 'all' ? 'All statuses' : value)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          {t('Search')}
        </Button>
        <details className="keys-columns">
          <summary>
            <SlidersHorizontal size={14} />
            {t('Columns')}
          </summary>
          <div>
            {columns.map(([key, label]) => (
              <label className="checkbox-label" key={key}>
                <input
                  type="checkbox"
                  checked={!hidden.includes(key)}
                  onChange={(e) => setHidden((previous) => (e.target.checked ? previous.filter((value) => value !== key) : [...previous, key]))}
                />
                {t(label)}
              </label>
            ))}
          </div>
        </details>
      </form>
      <p className="small-note keys-filter-note">{t('Status filters and sorting apply to the current page.')}</p>
      {!!count && (
        <div className="keys-bulk-bar">
          <strong>
            {t('Selected')}: {count}/100
          </strong>
          <Button size="sm" variant="outline" disabled={!!revealTarget} onClick={() => setRevealTarget(Object.values(selected))}>
            <Eye size={14} />
            {t('View keys')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDeleting(Object.keys(selected).map(Number))}>
            <Trash2 size={14} />
            {t('Delete')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
            {t('Clear selection')}
          </Button>
        </div>
      )}
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.isPending ? (
        <LoadingState />
      ) : (
        <>
          <div className="table-wrap keys-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={t('Select current page')}
                      checked={rows.length > 0 && rows.every((token) => !!selected[token.id])}
                      onChange={(e) => selectPage(e.target.checked)}
                    />
                  </th>
                  {visible.map(([key, label]) => {
                    const sortable = ['name', 'status', 'quota', 'created', 'accessed', 'expiry'].includes(key)
                    let direction: 'ascending' | 'descending' | 'none' = 'none'
                    if (sort?.key === key) direction = sort.direction === 1 ? 'ascending' : 'descending'
                    return (
                      <th key={key} aria-sort={sortable ? direction : undefined}>
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => setSort((previous) => ({ key: key as Sort, direction: previous?.key === key ? -previous.direction : 1 }))}
                          >
                            {t(label)}
                            <ArrowDownUp size={11} />
                          </button>
                        ) : (
                          t(label)
                        )}
                      </th>
                    )
                  })}
                  <th>{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((token) => (
                  <tr key={token.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${t('Select')} ${token.name}`}
                        checked={!!selected[token.id]}
                        disabled={!selected[token.id] && count >= 100}
                        onChange={(e) => select(token, e.target.checked)}
                      />
                    </td>
                    {visible.map(([key]) => {
                      let content: ReactNode = null
                      switch (key) {
                        case 'name':
                          content = <strong>{token.name}</strong>
                          break
                        case 'status':
                          content = (
                            <span className={`status-badge ${tokenStatus(token) === 'Enabled' ? 'success' : ''}`}>{t(tokenStatus(token))}</span>
                          )
                          break
                        case 'key':
                          content = (
                            <div className="key-mask">
                              <code>{token.key ? `sk-${token.key}` : 'sk-••••••••'}</code>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={!!revealTarget}
                                aria-label={`${t('View keys')} ${token.name}`}
                                onClick={() => setRevealTarget([token])}
                              >
                                <Eye size={13} />
                              </Button>
                            </div>
                          )
                          break
                        case 'quota':
                          content = (
                            <div className="tabular-nums font-mono">
                              {token.unlimited_quota ? '∞' : money(token.remain_quota)}
                              <small className="tabular-nums font-mono">
                                {t('Total usage')} {money(token.used_quota)}
                              </small>
                            </div>
                          )
                          break
                        case 'group':
                          content = (
                            <>
                              {token.group || 'default'}
                              {token.group === 'auto' && <small>{token.auto_groups?.join(' → ') || t('System default')}</small>}
                            </>
                          )
                          break
                        case 'models':
                          content = token.model_limits_enabled ? <code>{token.model_limits}</code> : t('All models')
                          break
                        case 'ips':
                          content = token.allow_ips ? <code>{token.allow_ips}</code> : '—'
                          break
                        case 'created':
                          content = date(token.created_time)
                          break
                        case 'accessed':
                          content = date(token.accessed_time)
                          break
                        case 'expiry':
                          content = token.expired_time === -1 ? t('Never expires') : date(token.expired_time)
                      }
                      return <td key={key}>{content}</td>
                    })}
                    <td>
                      <div className="action-buttons">
                        <Button variant="ghost" size="icon" aria-label={`${t('Edit')} ${token.name}`} onClick={() => setEditor(token)}>
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t(token.status === 1 ? 'Disable' : 'Enable')} ${token.name}`}
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate(token)}
                        >
                          <Power size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`${t('Delete')} ${token.name}`} onClick={() => setDeleting([token.id])}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="keys-empty">
              <MascotMark />
              <h3>{t('No API keys found')}</h3>
              {searching || filter !== 'all' || total > 0 ? (
                <>
                  <p>{t('Try another search or clear your filters.')}</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('')
                      setKeySearch('')
                      setApplied({ name: '', key: '' })
                      setFilter('all')
                      setPage(1)
                    }}
                  >
                    {t('Reset filters')}
                  </Button>
                </>
              ) : (
                <>
                  <p>{t('Create your first API key to start building.')}</p>
                  <Button variant="outline" onClick={() => setEditor('new')}>
                    <Plus size={13} />
                    {t('Create API key')}
                  </Button>
                </>
              )}
            </div>
          )}
          <div className="table-footer">
            <label>
              {t('Rows per page')}{' '}
              <select
                className="plain-select"
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                {[20, 50, 100].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <span>
              {total} {t('API keys')} · {page}/{pages}
            </span>
            <div>
              <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t('Previous')}>
                <ChevronLeft size={15} />
              </Button>
              <Button size="icon" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={t('Next')}>
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        </>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        {editor && status.data && (
          <TokenEditor
            key={editor === 'new' ? 'new' : editor.id}
            initial={editor === 'new' ? undefined : editor}
            status={status.data}
            requestedGroup={group}
            onClose={() => setEditor(null)}
          />
        )}{' '}
        {editor && !status.data && (
          <DialogContent>
            <DialogTitle>{t('API keys')}</DialogTitle>
            {status.error ? <ErrorState error={status.error} retry={() => status.refetch()} /> : <LoadingState />}
          </DialogContent>
        )}
      </Dialog>
      {revealTarget && (
        <SecurityDialog
          operation={{ scope: 'api_key.read_secret', context: { token_ids: revealTarget.map((token) => token.id) } }}
          title="View keys"
          onClose={() => setRevealTarget(null)}
          onAuthorized={(proof, signal) => reveal(revealTarget, proof, signal)}
        />
      )}
      <Dialog
        open={!!revealed && revealed.owner === userId}
        onOpenChange={(open) => {
          if (!open) setRevealed(null)
        }}
      >
        <DialogContent className="token-reveal">
          <DialogHeader>
            <DialogTitle>{revealed?.title}</DialogTitle>
            <DialogDescription>{t('Keep API keys secret. Close this dialog when finished.')}</DialogDescription>
          </DialogHeader>
          <div className="code-preview">
            <div>
              <span>API KEY</span>
              {revealed && <CopyButton value={revealed.keys} />}
            </div>
            <pre>{revealed?.keys}</pre>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Delete API key?')} ({deleting?.length})
            </AlertDialogTitle>
            <AlertDialogDescription>{t('Applications using this key will lose access.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>
              {t('Delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
