'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { AdminConfirm } from './shared'

/** Public-content drafts stay in memory; warn before link navigation or unload. */
export function SettingsDraftGuard(props: { active: boolean; busy: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [destination, setDestination] = useState<string | null>(null)
  const leaving = useRef(false)
  useEffect(() => {
    if (!props.active) return
    function unload(event: BeforeUnloadEvent) {
      if (leaving.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    function navigate(event: MouseEvent) {
      if (leaving.current || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element).closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.download || (anchor.target && anchor.target !== '_self')) return
      const url = new URL(anchor.href)
      if (!['http:', 'https:'].includes(url.protocol)) return
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return
      event.preventDefault()
      event.stopPropagation()
      setDestination(url.href)
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', navigate, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', navigate, true)
    }
  }, [props.active])
  if (!props.active || !destination) return null
  return (
    <AdminConfirm
      title={t('Discard unsaved changes?')}
      description={t('Your content draft has not been saved. Leaving this page will discard it.')}
      busy={props.busy}
      onClose={() => setDestination(null)}
      onConfirm={() => {
        leaving.current = true
        const url = new URL(destination)
        if (url.origin === location.origin) router.push(`${url.pathname}${url.search}${url.hash}`)
        else location.assign(url.href)
      }}
    />
  )
}
