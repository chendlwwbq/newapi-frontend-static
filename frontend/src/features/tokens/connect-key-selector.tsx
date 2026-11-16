'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { AdminPagination, AdminSearch } from '@/features/admin/shared'
import { SecurityDialog } from '@/features/auth/secure-verification/security-dialog'
import { api } from '@/lib/api/client'
import type { PageResult, Token } from '@/lib/api/types'
import { tokenStatus } from './token-form'

export function ConnectKeySelector({
  userId,
  sessionId,
  group,
  groupLabel,
  userGroup,
}: {
  userId: number
  sessionId: string
  group: string
  groupLabel?: string
  userGroup?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [keyword, setKeyword] = useState('')
  const [target, setTarget] = useState<Token | null>(null),
    [secret, setSecret] = useState<{ name: string; value: string } | null>(null)
  const params = new URLSearchParams({ p: String(page), size: '20' })
  if (keyword) params.set('keyword', keyword)
  const tokens = useQuery({
    queryKey: ['connect-keys', userId, sessionId, page, keyword],
    enabled: open,
    queryFn: ({ signal }) => api<PageResult<Token>>(`/api/token/${keyword ? 'search' : ''}?${params}`, { signal }),
    staleTime: 0,
    gcTime: 0,
  })
  const matchesGroup = (token: Token) => (token.group || userGroup) === group
  return (
    <section className="connect-keys">
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t('Choose an API key')}
      </Button>
      <p className="small-note">
        {t('Create a key in the selected group to use this route.')} {t('Group')}: {groupLabel || group}
      </p>
      <Dialog
        open={open && !target && !secret}
        onOpenChange={(value) => {
          if (!value) setOpen(false)
        }}
      >
        <DialogContent className="admin-editor">
          <DialogHeader>
            <DialogTitle>{t('Choose an API key')}</DialogTitle>
            <DialogDescription>{t('Create a key in the selected group to use this route.')}</DialogDescription>
          </DialogHeader>
          <AdminSearch
            onSearch={(value) => {
              setKeyword(value)
              setPage(1)
            }}
          />
          {tokens.error ? (
            <ErrorState error={tokens.error} retry={() => tokens.refetch()} />
          ) : tokens.isPending ? (
            <LoadingState />
          ) : (
            <>
              <div className="client-key-list">
                {tokens.data.items.map((token) => (
                  <div className="settings-collection-row" key={token.id}>
                    <span>
                      <strong>{token.name}</strong>
                      <small className="small-note">
                        {' '}
                        #{token.id} · {t('Group')}: {matchesGroup(token) ? groupLabel || group : token.group || userGroup || '—'} ·{' '}
                        {t(tokenStatus(token))}
                      </small>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!matchesGroup(token)}
                      onClick={() => {
                        if (matchesGroup(token)) setTarget(token)
                      }}
                    >
                      {t('Select')}
                    </Button>
                  </div>
                ))}
              </div>
              {!tokens.data.items.length && <EmptyState title={t('No data yet')} />}
              <AdminPagination page={page} total={tokens.data.total} onPage={setPage} />
            </>
          )}
          <Link href="/keys" className="text-link">
            {t('Manage API keys')} ↗
          </Link>
        </DialogContent>
      </Dialog>
      {target && (
        <SecurityDialog
          operation={{ scope: 'api_key.read_secret', context: { token_ids: [target.id] } }}
          title="View keys"
          onClose={() => setTarget(null)}
          onAuthorized={async (proof, signal) => {
            if (!matchesGroup(target)) throw new Error('Invalid parameters')
            const result = await api<{ key: string }>(`/api/token/${target.id}/key`, {
              method: 'POST',
              headers: { 'X-Security-Proof': proof },
              signal,
            })
            signal.throwIfAborted()
            if (!result.key) throw new Error('Invalid server response')
            setSecret({ name: target.name, value: result.key.startsWith('sk-') ? result.key : `sk-${result.key}` })
          }}
        />
      )}
      <Dialog
        open={!!secret}
        onOpenChange={(value) => {
          if (!value) setSecret(null)
        }}
      >
        <DialogContent className="token-reveal">
          <DialogHeader>
            <DialogTitle>{secret?.name}</DialogTitle>
            <DialogDescription>{t('Keep API keys secret. Close this dialog when finished.')}</DialogDescription>
          </DialogHeader>
          <div className="code-preview">
            <div>
              <span>API KEY</span>
              {secret && <CopyButton value={secret.value} />}
            </div>
            <pre>{secret?.value}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
