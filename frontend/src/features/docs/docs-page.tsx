'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState } from '@/components/shared/states'
import { useGatewayAddress } from './use-gateway-address'
import { ApiReference } from './api-reference'
import { guides, toolGuides, toolNames, type Guide } from './guides'

export function DocsPage({ slug = 'getting-started' }: { slug?: string }) {
  const { t } = useTranslation(),
    gateway = useGatewayAddress()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const tool = toolNames[slug]
  const guide: Guide = guides[slug] ||
    toolGuides[slug === 'claudecode' ? 'claude-code' : slug === 'codex' ? 'codex-cli' : slug] || {
      title: tool,
      intro: 'Check whether your client supports a custom gateway before configuring it.',
      sections: [
        {
          title: 'Connection settings',
          text: 'Consult your client documentation to confirm custom gateway support and the required protocol. The following values are gateway details, not a verified client configuration.',
          code: 'Gateway: {{origin}}\nOpenAI Base URL: {{origin}}/v1\nAPI Key: sk-YOUR_API_KEY\nModel: your-model',
        },
        { title: 'Verify the result', text: 'Check request logs after your first request to confirm the model and usage.' },
      ],
    }
  return (
    <main className="page-container" id="content">
      <div className="docs-layout">
        <Button
          type="button"
          variant="outline"
          className="docs-mobile-nav-toggle"
          aria-controls="docs-navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {tool || t(guide.title)}
          <ChevronDown aria-hidden="true" />
        </Button>
        <aside
          id="docs-navigation"
          className={`docs-sidebar${mobileNavOpen ? ' is-open' : ''}`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setMobileNavOpen(false)
          }}
        >
          <Link href="/docs">{t('Help center')}</Link>
          {Object.entries(guides).map(([id, entry]) => (
            <Link key={id} href={`/docs/${id}`} aria-current={slug === id ? 'page' : undefined}>
              {t(entry.title)}
            </Link>
          ))}
          <Link href="/docs/library">{t('Developer documentation')}</Link>
          <details className="docs-tool-nav" open={!!tool}>
            <summary>{t('Clients')}</summary>
            {Object.entries(toolNames)
              .filter(([id]) => !['claudecode', 'codex'].includes(id))
              .map(([id, name]) => (
                <Link href={`/docs/${id}`} key={id} aria-current={slug === id ? 'page' : undefined}>
                  {name}
                </Link>
              ))}
          </details>
        </aside>
        <article className="docs-article max-w-3xl">
          <div className="docs-eyebrow">eva · {t('New API documentation')}</div>
          <h1>{tool || t(guide.title)}</h1>
          <p className="mb-4 leading-7">{t(guide.intro)}</p>
          {'source' in guide && guide.source && (
            <p>
              <a className="text-link" href={guide.source} target="_blank" rel="noreferrer">
                {t('Official documentation')} ↗
              </a>
            </p>
          )}
          {gateway.error && <ErrorState error={gateway.error} retry={gateway.retry} />}
          <nav className="docs-section-nav" aria-label={t('On this page')}>
            {guide.sections.map((section, index) => (
              <a href={`#section-${index}`} key={section.title}>
                {t(section.title)}
              </a>
            ))}
          </nav>
          {guide.sections.map((section, index) => (
            <section id={`section-${index}`} key={section.title}>
              <h2>{t(section.title)}</h2>
              <p className="mb-4 leading-7">{t(section.text)}</p>
              {section.metrics && (
                <table className="docs-endpoints">
                  <thead>
                    <tr>
                      <th scope="col">{t('Metric')}</th>
                      <th scope="col">{t('Description')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.metrics.map((metric) => (
                      <tr key={metric.name}>
                        <th scope="row">{t(metric.name)}</th>
                        <td>{t(metric.description)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {section.link && (
                <Link href={section.link.href} className="text-link">
                  {t(section.link.label)} ↗
                </Link>
              )}
              {section.code && gateway.address && (
                <div className="code-preview">
                  <div>
                    <span>New API</span>
                    <CopyButton value={section.code.replaceAll('{{origin}}', gateway.address)} />
                  </div>
                  <pre>{section.code.replaceAll('{{origin}}', gateway.address)}</pre>
                </div>
              )}
            </section>
          ))}
          {(slug === 'api' || tool) && <ApiReference />}
          <div style={{ marginTop: 50 }}>
            <Link className="pill-button" href="/pricing">
              {t('Browse all models')}
            </Link>
          </div>
        </article>
      </div>
    </main>
  )
}
