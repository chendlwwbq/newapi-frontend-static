'use client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { ArrowRight, ChevronDown, Check, Layers3, Plus, ReceiptText, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth, refreshSession } from '@/lib/auth/session'
import type { Catalog } from '@/lib/api/types'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { ModuleAccessError } from '@/features/catalog/module-access-error'
import { Reveal } from '@/components/motion/reveal'
import { Mascot } from '@/components/motion/mascot'
const Globe = dynamic(() => import('./globe').then((module) => module.Globe), {
  ssr: false,
  loading: () => <div className="hero-globe" aria-hidden="true" />,
})
import { ModelCard } from '@/features/catalog/model-card'
import { filterCatalog, readCatalogFilters } from '@/features/catalog/catalog-state'
import { CopyButton } from '@/components/shared/copy-button'
import { HomeModelSearch } from './home-model-search'
import { HomeConnect } from './home-connect'
import { HomeClosing } from './home-closing'
import { HeroEcho } from './hero-echo'
import { homeCatalogKey, visibleHomeModels } from './home-catalog'

const heroCategories = [
  ['text', 'Code'],
  ['image', 'Create images'],
  ['video', 'Create videos'],
]

const tools = [
  ['Claude Code', 'claudecode-color'],
  ['Cursor', 'cursor'],
  ['Codex CLI', 'codex-color'],
  ['Cline', 'cline'],
  ['Roo Code', 'roocode'],
  ['Kilo Code', 'kilocode'],
  ['Windsurf', 'windsurf'],
  ['Trae', 'trae-color'],
  ['Cherry Studio', 'cherrystudio-color'],
  ['LobeHub', 'lobehub-color'],
  ['Open WebUI', 'openwebui'],
  ['Dify', 'dify-color'],
  ['Coze', 'coze'],
  ['n8n', 'n8n-color'],
  ['LangChain', 'langchain-color'],
  ['GitHub', 'github'],
]

export function HomePage({
  initialCatalog,
  stats,
  faqEnabled = true,
  faq,
  customContent,
}: {
  initialCatalog: Catalog | null
  stats: { registered_users: number; online_users: number }
  faqEnabled?: boolean
  faq?: { id: number; question: string; answer: string }[]
  customContent?: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const auth = useAuth()
  const catalog = useQuery({
    queryKey: homeCatalogKey(auth.bundle),
    enabled: auth.phase === 'ready',
    queryFn: ({ signal }) => api<Catalog>('/api/catalog/models?currency=CNY', { signal }),
    initialData: !auth.bundle ? (initialCatalog ?? undefined) : undefined,
    staleTime: 0,
  })
  const models = useMemo(
    () => visibleHomeModels(auth, initialCatalog, catalog.data, catalog.isError),
    [auth.phase, auth.bundle, initialCatalog, catalog.data, catalog.isError]
  )
  const pending = (auth.phase === 'loading' && !initialCatalog) || (auth.phase === 'ready' && catalog.isPending)
  const catalogError =
    auth.phase === 'error' ? (
      <ErrorState
        error={new Error(auth.error || 'Session refresh failed')}
        retry={() => {
          void refreshSession().catch((error) => toast.error(t(error.message)))
        }}
      />
    ) : catalog.error ? (
      <ModuleAccessError
        error={catalog.error}
        retry={() => {
          void catalog.refetch()
        }}
      />
    ) : null
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language),
    search = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState('all'),
    [sort, setSort] = useState('name'),
    [previewModel, setPreviewModel] = useState('')
  const filtered = useMemo(
    () => filterCatalog(models, readCatalogFilters(new URLSearchParams({ modality: category, sort }).toString())),
    [models, category, sort]
  )
  const visible = filtered.slice(0, 8)
  const providers = new Set(models.map((model) => model.provider).filter(Boolean)).size
  const routes = models.reduce((total, model) => total + model.offerings_count, 0)
  return (
    <main id="content" className="home-page">
      <section className="home-hero">
        <Globe />
        <div className="hero-vignette" />
        <HeroEcho
          model={
            models.some((item) => item.configured_model_id === previewModel && (category === 'all' || item.modality === category)) ? previewModel : ''
          }
        />
        <div className="hero-content">
          <div className="hero-heading">
            <h1
              lang="en"
              className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent"
            >
              All models, one place.
            </h1>
            <p className="text-foreground/80">{t('Intelligence together. Creativity ahead.')}</p>
          </div>
          <div className="hero-model">
            <Mascot />
            <HomeModelSearch models={models} modality={category} inputRef={search} onPreviewChange={setPreviewModel} />
          </div>
          <div className="hero-tags">
            {heroCategories.map(([id, label]) => (
              <Button
                type="button"
                variant="ghost"
                key={id}
                aria-pressed={category === id}
                onClick={() => {
                  setCategory(id)
                  search.current?.focus()
                }}
              >
                {t(label)}
              </Button>
            ))}
          </div>
          <div className="hero-cta">
            <Link href="/keys" className="pill-button">
              {t('Get your API Key')}
            </Link>
            <Link href="/playground" className="pill-button secondary">
              {t('Playground')}
            </Link>
            <Link href="/pricing" className="pill-button secondary">
              {t('Browse all models')}
            </Link>
          </div>
        </div>
        <a className="hero-scroll" href="#models" aria-label={t('Models')}>
          <ChevronDown size={20} />
        </a>
      </section>
      <div className="home-stats">
        <div>
          <strong>{pending || catalogError ? '—' : formatNumber(models.length, locale)}</strong>
          <span>
            {t('Models available')} · {pending || catalogError ? '—' : formatNumber(providers, locale)} {t('Providers')}
          </span>
        </div>
        <div>
          <strong>{formatNumber(stats.registered_users, locale)}</strong>
          <span>
            {t('Registered users')} · <i className="online-dot" /> {formatNumber(stats.online_users, locale)} {t('Online now')}
          </span>
        </div>
        <div>
          <strong>{pending || catalogError ? '—' : formatNumber(routes, locale)}</strong>
          <span>{t('Routes')}</span>
        </div>
        <div className="provider-strip">
          {['openai', 'claude-color', 'gemini-color', 'deepseek-color', 'qwen-color'].map((name) => (
            <img key={name} src={`/orbis/home/${name}.svg`} alt={name} width={24} height={24} />
          ))}
        </div>
      </div>
      <section className="section-container" id="models">
        <Reveal className="section-heading">
          <div>
            <h2>{t('Pick a model to begin.')}</h2>
            <p>{t('Compare models, prices and routes in one place.')}</p>
          </div>
          <Link href="/pricing" className="text-link">
            {t('Model catalog')}
            <ArrowRight size={16} />
          </Link>
        </Reveal>
        {catalogError ||
          (pending ? (
            <LoadingState />
          ) : (
            <>
              <div className="home-model-toolbar">
                <div className="category-tabs">
                  {[
                    ['all', 'All'],
                    ['text', 'Text'],
                    ['image', 'Image'],
                    ['video', 'Video'],
                    ['audio', 'Audio'],
                    ['embedding', 'Embedding'],
                  ].map(([id, label]) => (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-pressed={category === id}
                      data-active={category === id}
                      key={id}
                      onClick={() => setCategory(id)}
                    >
                      {t(label)}
                    </Button>
                  ))}
                </div>
                <div className="category-tabs home-sort" role="group" aria-label={t('Sort')}>
                  {[
                    ['name', 'Name'],
                    ['price', 'Price'],
                    ['context', 'Context length'],
                  ].map(([id, label]) => (
                    <Button type="button" variant="ghost" key={id} aria-pressed={sort === id} data-active={sort === id} onClick={() => setSort(id)}>
                      {t(label)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="model-grid">
                {visible.map((model, index) => (
                  <Reveal key={model.model_key} delay={(index % 4) * 0.04} className="home-model-card">
                    <ModelCard model={model} />
                    <CopyButton value={model.configured_model_id} label={`${t('Copy')} ${t('Model ID')}`} />
                  </Reveal>
                ))}
              </div>
              {!visible.length && (
                <div className="catalog-empty">
                  <Mascot small />
                  <p>{t(category === 'all' ? 'No models configured' : 'No results')}</p>
                  {category === 'all' ? (
                    <Link href="/channels">{t('Add a channel in the admin console to publish models.')}</Link>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => setCategory('all')}>
                      {t('All')}
                    </Button>
                  )}
                </div>
              )}
            </>
          ))}
      </section>
      <section className="section-container" id="start">
        <Reveal className="section-heading">
          <div>
            <h2>{t('Get connected in three steps.')}</h2>
            <p>{t('Create an account, choose a model and route, then create an API key.')}</p>
          </div>
          <Link href="/docs" className="text-link">
            {t('Read the docs')}
            <ArrowRight size={16} />
          </Link>
        </Reveal>
        {catalogError || (pending ? <LoadingState /> : <HomeConnect models={models} />)}
      </section>
      <section className="section-container">
        <Reveal className="section-heading">
          <div>
            <h2>{t('Focus on your product.')}</h2>
            <p>{t('One key. Endless possibilities.')}</p>
          </div>
        </Reveal>
        <div className="benefits-grid">
          {[
            [Layers3, 'Transparent routes', 'Compare models, prices and routes in one place.'],
            [ReceiptText, 'Every request accounted for', 'Your console shows request logs, usage and remaining balance.'],
            [Terminal, 'Ready in minutes', 'Create an account, choose a model and route, then create an API key.'],
          ].map(([Icon, title, description], index) => {
            const Graphic = Icon as typeof Layers3
            return (
              <Reveal key={title as string} delay={index * 0.07} className="benefit-card">
                <Graphic size={24} strokeWidth={1.3} />
                <h3>{t(title as string)}</h3>
                <p>{t(description as string)}</p>
                <div className="benefit-illustration">
                  {index === 0 ? (
                    <>
                      <strong>{pending || catalogError ? '—' : formatNumber(routes, locale)}</strong>
                      <span>{t('Routes')}</span>
                    </>
                  ) : index === 1 ? (
                    <>
                      <ReceiptText size={40} />
                      <Check size={20} />
                    </>
                  ) : (
                    <div className="benefit-steps">
                      <span>01 {t('Choose a model')}</span>
                      <span>02 {t('Choose a route')}</span>
                      <span>03 {t('Create Key for this route')}</span>
                    </div>
                  )}
                </div>
                <Link href={index === 1 ? '/usage-logs/common' : index === 0 ? '/pricing' : '/docs'} className="text-link">
                  {t(index === 1 ? 'Usage logs' : index === 0 ? 'Model catalog' : 'Getting started')}
                  <ArrowRight size={15} />
                </Link>
              </Reveal>
            )
          })}
        </div>
      </section>
      <section className="section-container tools-section">
        <Reveal>
          <h2>{t('Your favorite tools, connected.')}</h2>
          <p>{t('Connect tools using your Base URL and API Key.')}</p>
        </Reveal>
        <div className="tools-grid">
          {tools.map(([name, icon]) => (
            <Link key={name} href={`/docs/${name.toLowerCase().replaceAll(' ', '-')}`}>
              <img src={`/orbis/home/${icon}.svg`} alt="" width={27} height={27} />
              <span>{name}</span>
            </Link>
          ))}
        </div>
      </section>
      {customContent && <section className="section-container custom-home-content">{customContent}</section>}
      {faqEnabled && (
        <section className="section-container faq-section">
          <Reveal>
            <h2>{t('Frequently asked questions')}</h2>
            <Link href="/docs" className="pill-button secondary">
              {t('Read the docs')}
            </Link>
          </Reveal>
          <div>
            {faq?.length
              ? faq.map((item, index) => (
                  <details name="home-faq" key={item.id} open={index === 0}>
                    <summary>
                      {item.question}
                      <Plus size={17} />
                    </summary>
                    <p>{item.answer}</p>
                  </details>
                ))
              : [
                  ['How do I get started?', 'Create an account, choose a model and route, then create an API key.'],
                  ['How do I choose a route?', 'Compare price, available protocols and measured performance on the model page.'],
                  ['Where can I see my usage?', 'Your console shows request logs, usage and remaining balance.'],
                ].map(([q, a], index) => (
                  <details name="home-faq" key={q} open={index === 0}>
                    <summary>
                      {t(q)}
                      <Plus size={17} />
                    </summary>
                    <p>{t(a)}</p>
                    {index === 0 && (
                      <Link href="/docs" className="text-link">
                        {t('Getting started')}
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </details>
                ))}
          </div>
        </section>
      )}
      <HomeClosing models={models} />
    </main>
  )
}
