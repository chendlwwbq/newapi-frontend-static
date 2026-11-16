'use client'
import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ErrorState } from '@/components/shared/states'
import type { AdminUser } from './types'

export interface UserForm {
  id?: number
  username: string
  display_name: string
  password?: string
  role: number
  group: string
  remark: string
  admin_permissions?: Record<string, Record<string, boolean>>
}

interface PermissionCatalog {
  resources: {
    resource: string
    label_key: string
    actions: { action: string; label_key: string }[]
  }[]
  roles: {
    key: string
    grants: Record<string, Record<string, boolean>>
  }[]
}

export function UserEditor({
  initial,
  root,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  initial: AdminUser | null
  root: boolean
  busy: boolean
  error: string
  onSubmit: (value: UserForm) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState<UserForm>({
    id: initial?.id,
    username: initial?.username || '',
    display_name: initial?.display_name || '',
    password: '',
    role: initial?.role || 1,
    group: initial?.group || 'default',
    remark: initial?.remark || '',
  })
  const groups = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => api<string[]>('/api/group/'),
  })
  const catalog = useQuery({
    queryKey: ['admin-permission-catalog'],
    enabled: root,
    queryFn: () => api<PermissionCatalog>('/api/authz/catalog'),
  })
  const matrix = value.admin_permissions || initial?.admin_permissions || catalog.data?.roles.find((role) => role.key === 'admin')?.grants || {}
  const patch = (next: Partial<UserForm>) => setValue((current) => ({ ...current, ...next }))

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit(value)
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
          <DialogTitle>{t(initial ? 'Edit user' : 'Add user')}</DialogTitle>
          <DialogDescription>{t('Manage account details and administrative access.')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit}>
          <div className="admin-form-grid">
            <label className="field">
              <span>{t('Username')}</span>
              <input
                required
                autoFocus
                maxLength={20}
                value={value.username}
                autoComplete="off"
                onChange={(event) => patch({ username: event.target.value })}
              />
            </label>

            <label className="field">
              <span>{t('Display name')}</span>
              <input maxLength={20} value={value.display_name} onChange={(event) => patch({ display_name: event.target.value })} />
            </label>

            <label className="field admin-wide">
              <span>{t(initial ? 'New password (leave blank to keep)' : 'Password')}</span>
              <input
                type="password"
                autoComplete="new-password"
                required={!initial}
                minLength={8}
                maxLength={128}
                value={value.password}
                onChange={(event) => patch({ password: event.target.value })}
              />
            </label>

            {!initial && (
              <label className="field">
                <span>{t('Role')}</span>
                <select value={value.role} onChange={(event) => patch({ role: Number(event.target.value) })}>
                  <option value={1}>{t('User')}</option>
                  {root && <option value={10}>{t('Administrator')}</option>}
                </select>
              </label>
            )}

            {initial && (
              <>
                <label className="field">
                  <span>{t('Group')}</span>
                  <input
                    required
                    list="admin-user-groups"
                    maxLength={64}
                    value={value.group}
                    onChange={(event) => patch({ group: event.target.value })}
                  />
                  <datalist id="admin-user-groups">
                    {groups.data?.map((group) => (
                      <option key={group} value={group} />
                    ))}
                  </datalist>
                </label>

                <label className="field">
                  <span>{t('Remark')}</span>
                  <input maxLength={255} value={value.remark} onChange={(event) => patch({ remark: event.target.value })} />
                </label>
              </>
            )}
          </div>

          {root && value.role === 10 && (
            <details className="admin-advanced">
              <summary>{t('Admin permissions')}</summary>
              {catalog.error ? (
                <ErrorState error={catalog.error} retry={() => catalog.refetch()} />
              ) : catalog.isPending ? (
                <p>{t('Loading')}</p>
              ) : (
                catalog.data.resources.map((resource) => (
                  <fieldset className="admin-permissions" key={resource.resource}>
                    <legend>{t(resource.label_key)}</legend>
                    {resource.actions.map((action) => (
                      <label className="checkbox-label" key={action.action}>
                        <input
                          type="checkbox"
                          checked={matrix[resource.resource]?.[action.action] === true}
                          onChange={(event) =>
                            patch({
                              admin_permissions: {
                                ...matrix,
                                [resource.resource]: {
                                  ...matrix[resource.resource],
                                  [action.action]: event.target.checked,
                                },
                              },
                            })
                          }
                        />
                        {t(action.label_key)}
                      </label>
                    ))}
                  </fieldset>
                ))
              )}
            </details>
          )}

          {error && (
            <p className="inline-error" role="alert">
              {t(error)}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t(busy ? 'Loading' : 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
