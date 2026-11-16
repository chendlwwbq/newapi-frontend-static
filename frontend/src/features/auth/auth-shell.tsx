'use client'
import Link from 'next/link'
import { Check, X, Layers3, ReceiptText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Brand } from '@/components/layout/public-shell'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { Mascot } from '@/components/motion/mascot'
import { ModelTyping } from '@/components/motion/model-typing'

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <main className="auth-stage" id="content">
      <div className="auth-underlay" aria-hidden="true" inert>
        <Brand />
        <p>All models, one place.</p>
        <div className="auth-underlay-orbit" />
      </div>
      <div className="auth-page auth-card">
        <section className="auth-art">
          <h2 lang="en">
            Welcome to
            <br />
            the deep end.
          </h2>
          <p>{t('Your models live in this ocean. Call them with one key.')}</p>
          <div className="auth-context-scale" aria-hidden="true">
            <span>context</span>
            {['128K', '256K', '512K', '1M', '2M'].map((value) => (
              <small key={value}>{value}</small>
            ))}
          </div>
          <div className="auth-connection-example" aria-label={t('Connection example')}>
            <Mascot />
            <div className="auth-key-example" aria-hidden="true">
              <span>key</span>
              <code>sk-eva-••••••••</code>
            </div>
            <ModelTyping models={[]} />
          </div>
          <ul className="auth-features">
            <li>
              <Layers3 size={14} />
              {t('One key. Endless possibilities.')}
            </li>
            <li>
              <ReceiptText size={14} />
              {t('Transparent routes')}
            </li>
            <li>
              <Check size={14} />
              {t('Every request accounted for')}
            </li>
          </ul>
          <small className="auth-attribution">Powered by New API / QuantumNous</small>
        </section>
        <section className="auth-form-panel">
          <div className="auth-card-tools">
            <LanguageSwitcher />
            <Link href="/" className="auth-close" aria-label={t('Close')}>
              <X size={18} />
            </Link>
          </div>
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <div className="auth-form">{children}</div>
          <small className="auth-mobile-attribution">New API / QuantumNous</small>
        </section>
      </div>
    </main>
  )
}
