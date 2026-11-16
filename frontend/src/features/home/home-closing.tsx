'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Reveal } from '@/components/motion/reveal'
import { Mascot } from '@/components/motion/mascot'
import { ModelTyping } from '@/components/motion/model-typing'
import type { CatalogModel } from '@/lib/api/types'

export function HomeClosing(props: { models: CatalogModel[] }) {
  const { t } = useTranslation()
  return (
    <section className="section-container home-closing">
      <Reveal className="home-closing-panel">
        <div>
          <h2>{t('The next name is yours to write.')}</h2>
          <ModelTyping models={props.models} quoted />
          <div className="hero-cta">
            <Link href="/keys" className="pill-button">
              {t('Get your API Key')}
            </Link>
            <Link href="/pricing" className="pill-button secondary">
              {t('Browse all models')}
            </Link>
          </div>
        </div>
        <Mascot />
      </Reveal>
    </section>
  )
}
