'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { freshAuthHeaders, useAuth } from '@/lib/auth/session'
import { pluginIconUrl, resolvePluginIcon, textAvatarClass, type PluginIconInput } from './icon-contract'

const LobeIcon = dynamic(() =>
  import('./lobe-icon').then((module) => ({ default: (props: { name: string; size: number }) => module.getLobeIcon(props.name, props.size) }))
)
type IconProps = Omit<PluginIconInput, 'key'> & { pluginKey: string; version?: string; sourceHash?: string; size?: number }

export function PluginIcon(props: IconProps) {
  const { bundle } = useAuth(),
    [image, setImage] = useState<{ blob: Blob; src: string } | null>(null),
    [failed, setFailed] = useState('')
  const icon = useQuery({
    queryKey: ['task-plugin-icon', bundle?.user.id, bundle?.session.sid, props.pluginKey, props.version, props.sourceHash],
    enabled: !!props.hasIcon && bundle?.user.role === 100,
    queryFn: async ({ signal }) => {
      const response = await fetch(pluginIconUrl(props.pluginKey, props.version), {
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: await freshAuthHeaders(),
      })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null
      return response.blob()
    },
    staleTime: 300_000,
    retry: false,
    meta: { errorToast: false },
  })
  useEffect(() => {
    if (!icon.data) return
    const src = URL.createObjectURL(icon.data)
    setImage({ blob: icon.data, src })
    return () => URL.revokeObjectURL(src)
  }, [icon.data])
  const src = props.iconSrc || (image?.blob === icon.data ? image?.src : undefined)
  const descriptor = resolvePluginIcon({ ...props, key: props.pluginKey, hasIcon: false, iconSrc: src && src !== failed ? src : undefined })
  const size = props.size || 36
  let content
  if (descriptor.kind === 'image')
    content = <img src={descriptor.src} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setFailed(descriptor.src)} />
  else if (descriptor.kind === 'lobe') content = <LobeIcon name={descriptor.name} size={size} />
  else content = <span className={`plugin-text-avatar ${textAvatarClass(descriptor.colorSeed)}`}>{descriptor.label}</span>
  return (
    <span className="plugin-icon" aria-hidden="true" style={{ width: size, height: size }}>
      {content}
    </span>
  )
}
