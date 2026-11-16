'use client'
import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }
      ) => string
      remove: (id: string) => void
    }
  }
}

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null),
    [ready, setReady] = useState(false)
  useEffect(() => {
    if (!container.current || !window.turnstile) return
    const widget = window.turnstile.render(container.current, {
      sitekey: siteKey,
      callback: onToken,
      'expired-callback': () => onToken(''),
      'error-callback': () => onToken(''),
    })
    return () => {
      window.turnstile?.remove(widget)
    }
  }, [ready, siteKey, onToken])
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} />
      <div ref={container} className="auth-captcha" />
    </>
  )
}
