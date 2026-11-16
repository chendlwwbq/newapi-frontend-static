'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { LanguageSwitcher } from './language-switcher'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { Bell, Menu, Moon, Sun, ChevronDown, X, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth/session'
import { Mascot, MascotMark } from '@/components/motion/mascot'
import { parseHeaderNavModules } from './navigation-config'

const PublicSearch = dynamic(() => import('./public-search'))

export function Brand() {
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => api<{ system_name: string; logo: string }>('/api/status', { anonymous: true }),
    staleTime: 60_000,
  })
  const name = status.data?.system_name && status.data.system_name !== 'New API' ? status.data.system_name : 'eva'
  const logo = status.data?.logo
  return (
    <Link className="brand" href="/">
      {logo && /^(https?:\/\/|\/(?!\/))/.test(logo) ? (
        <img src={logo} alt="" width={28} height={28} />
      ) : (
        <span className="brand-mascot">
          <MascotMark />
        </span>
      )}
      <strong>{name}</strong>
    </Link>
  )
}
export function PublicHeader() {
  const { t } = useTranslation(),
    auth = useAuth(),
    path = usePathname()
  const [menu, setMenu] = useState(false),
    [expanded, setExpanded] = useState(''),
    [searchOpen, setSearchOpen] = useState(false),
    [searchLoaded, setSearchLoaded] = useState(false)
  const nav = useRef<HTMLElement>(null),
    menuButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (menu) nav.current?.querySelector<HTMLAnchorElement>('a')?.focus()
  }, [menu])
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => api<{ HeaderNavModules?: string }>('/api/status', { anonymous: true }),
    staleTime: 60_000,
  })
  const navigation = parseHeaderNavModules(status.data?.HeaderNavModules)
  const links = [
    ['/', 'Home', 'home'],
    ['/pricing', 'Models', 'pricing'],
    ['/docs', 'Docs', 'docs'],
    ['/news', 'News', 'news'],
    ['/leaderboards', 'Rankings', 'rankings'],
    ['/about', 'About', 'about'],
  ].filter(([, , module]) => (typeof navigation[module] === 'object' ? navigation[module].enabled : navigation[module] !== false))
  const pricing = navigation.pricing,
    allowModels = pricing.enabled && (!pricing.requireAuth || !!auth.bundle),
    allowDocs = navigation.docs !== false
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && path !== '/docs' && path !== '/docs/all') {
        if (document.querySelector('[data-slot="dialog-content"]')) return
        event.preventDefault()
        setSearchLoaded(true)
        setSearchOpen(true)
        setMenu(false)
        setExpanded('')
      }
      if (event.key === 'Escape') {
        const returnFocus = nav.current?.classList.contains('open') && nav.current.contains(document.activeElement)
        setMenu(false)
        setExpanded('')
        if (returnFocus) menuButton.current?.focus()
      }
    }
    function outside(event: PointerEvent) {
      if (!nav.current?.contains(event.target as Node)) setExpanded('')
    }
    window.addEventListener('keydown', keyboard)
    window.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('keydown', keyboard)
      window.removeEventListener('pointerdown', outside)
    }
  }, [path])
  function theme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem('new-api:theme', next)
  }
  function close() {
    setMenu(false)
    setExpanded('')
  }
  function destination(href: string, module: string) {
    const config = navigation[module]
    if (typeof config === 'object' && config.requireAuth && !auth.bundle) return `/sign-in?redirect=${encodeURIComponent(href)}`
    return href
  }
  return (
    <header className="public-header eva-public-header">
      <Brand />
      <nav
        ref={nav}
        id="public-navigation"
        className={menu ? 'public-nav open' : 'public-nav gap-7 lg:gap-8'}
        aria-label={t('Main navigation')}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setExpanded('')
        }}
      >
        {links.map(([href, label, module]) => {
          const entries =
            module === 'pricing'
              ? [
                  ['Model catalog', '/pricing'],
                  ['Text', '/pricing?modality=text'],
                  ['Image', '/pricing?modality=image'],
                  ['Video', '/pricing?modality=video'],
                  ['Audio', '/pricing?modality=audio'],
                ]
              : []
          if (module === 'docs')
            entries.push(['Getting started', '/docs'], ['API reference', '/docs/api'], ['Integration guides', '/docs/getting-started'])
          return (
            <div className="public-nav-item" key={href}>
              <div className="public-nav-label">
                <Link
                  className="min-w-[4rem] justify-center px-3 py-1"
                  href={destination(href, module)}
                  aria-current={(href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined}
                  onClick={close}
                >
                  {t(label)}
                </Link>
                {!!entries.length && (
                  <button
                    type="button"
                    className="public-nav-toggle"
                    aria-label={`${t(label)} ${t('Open menu')}`}
                    aria-expanded={expanded === module}
                    aria-controls={`nav-${module}`}
                    onClick={() => setExpanded(expanded === module ? '' : module)}
                  >
                    <ChevronDown size={12} />
                  </button>
                )}
              </div>
              {!!entries.length && expanded === module && (
                <div className="public-nav-dropdown" id={`nav-${module}`}>
                  {entries.map(([title, url]) => (
                    <Link key={url} href={destination(url, module)} onClick={close}>
                      {t(title)}
                      <span aria-hidden="true">↗</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div className="mobile-nav-actions">
          <LanguageSwitcher />
          <Link className="icon-button header-notifications" href="/dashboard/overview" aria-label={t('Notifications')} onClick={close}>
            <Bell size={17} />
          </Link>
          <button className="icon-button theme-toggle" aria-label={t('Toggle theme')} onClick={theme}>
            <Moon size={16} className="moon-icon" />
            <Sun size={16} className="sun-icon" />
          </button>
          {(!auth.bundle || navigation.console) && (
            <Link className="header-login" href={auth.bundle ? '/dashboard/overview' : '/sign-in'} onClick={close}>
              {t(auth.bundle ? 'Console' : 'Sign in')}
            </Link>
          )}
        </div>
      </nav>
      <div className="header-actions">
        <button
          type="button"
          className="header-search"
          aria-label={t('Search models and docs')}
          onClick={() => {
            setSearchLoaded(true)
            setSearchOpen(true)
            close()
          }}
        >
          <Search size={16} />
          <span>{t('Search models and docs')}</span>
          <kbd>⌘ K</kbd>
        </button>
        <Link className="icon-button header-notifications" href="/dashboard/overview" aria-label={t('Notifications')}>
          <Bell size={17} />
        </Link>
        <button className="icon-button theme-toggle" aria-label={t('Toggle theme')} onClick={theme}>
          <Moon size={16} className="moon-icon" />
          <Sun size={16} className="sun-icon" />
        </button>
        <LanguageSwitcher />
        {(!auth.bundle || navigation.console) && (
          <Link className="header-login" href={auth.bundle ? '/dashboard/overview' : '/sign-in'}>
            {t(auth.bundle ? 'Console' : 'Sign in')}
          </Link>
        )}
        <button
          ref={menuButton}
          type="button"
          className="icon-button mobile-menu"
          aria-label={t('Open menu')}
          aria-controls="public-navigation"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {searchLoaded && <PublicSearch open={searchOpen} onOpenChange={setSearchOpen} allowModels={allowModels} allowDocs={allowDocs} />}
    </header>
  )
}
export function PublicFooter({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <footer className="public-footer">
      {children}
      <div className="footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>{t('One key. Endless possibilities.')}</p>
          <Link href="/keys">{t('Get your API Key')} ↗</Link>
        </div>
        {[
          [
            'Product',
            [
              ['Model catalog', '/pricing'],
              ['Getting started', '/docs'],
              ['Console', '/dashboard/overview'],
            ],
          ],
          [
            'Explore',
            [
              ['News', '/news'],
              ['Rankings', '/leaderboards'],
              ['API reference', '/docs/api'],
            ],
          ],
        ].map(([title, links]) => (
          <div key={title as string}>
            <h4>{t(title as string)}</h4>
            {(links as string[][]).map(([label, href]) => (
              <Link key={href} href={href}>
                {t(label)}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        <span>
          eva © {new Date().getFullYear()} · Powered by{' '}
          <a href="https://github.com/QuantumNous/new-api" target="_blank" rel="noreferrer">
            New API / QuantumNous
          </a>
        </span>
        <div>
          <Link href="/user-agreement">{t('Terms of service')}</Link>
          <Link href="/privacy-policy">{t('Privacy policy')}</Link>
        </div>
      </div>
    </footer>
  )
}
export function SupportDock() {
  return (
    <div className="support-dock">
      <Mascot small />
    </div>
  )
}
