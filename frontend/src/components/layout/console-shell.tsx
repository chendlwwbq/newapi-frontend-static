'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ChartNoAxesCombined,
  KeyRound,
  Network,
  FileText,
  ListTodo,
  Wallet,
  UserRound,
  FlaskConical,
  Layers3,
  Users,
  Gift,
  Settings,
  Shield,
  Menu,
  LogOut,
  ArrowUpRight,
  BookOpen,
  Server,
  Puzzle,
  Image,
  RefreshCw,
  Clapperboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Brand } from './public-shell'
import { LanguageSwitcher } from './language-switcher'
import { useAuth, logout, refreshSession } from '@/lib/auth/session'
import { api } from '@/lib/api/client'
import type { User } from '@/lib/api/types'
import { useQuotaFormatter } from '@/lib/format'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { toast } from 'sonner'
import { sidebarItemVisible } from './navigation-config'
import { loadInterfaceLanguage, persistInterfaceLanguage } from '@/i18n/load-language'
import { consoleReturnPath } from '@/features/auth/console-return'
import { SystemUpdateNotice } from '@/features/admin/system-update-notice'

const sections = [
  {
    title: 'General',
    items: [
      ['/playground', 'Playground', FlaskConical],
      ['/dashboard/overview', 'Overview', Activity],
      ['/dashboard/models', 'Model analytics', ChartNoAxesCombined],
      ['/dashboard/tasks', 'Task analytics', Clapperboard],
      ['/dashboard/status', 'Service status', Activity],
      ['/keys', 'API keys', KeyRound],
      ['/api-hub', 'API hub', Network],
      ['/usage-logs/common', 'Usage logs', FileText],
      ['/usage-logs/drawing', 'Drawing Logs', Image],
      ['/usage-logs/task', 'Task logs', ListTodo],
      ['/usage-logs/audit', 'Audit logs', Shield],
    ],
  },
  {
    title: 'Personal',
    items: [
      ['/wallet', 'Wallet', Wallet],
      ['/profile', 'Profile', UserRound],
      ['/security', 'Security', Shield],
    ],
  },
  {
    title: 'Admin',
    items: [
      ['/channels', 'Channels', Layers3],
      ['/ops/overview', 'Operations', Activity],
      ['/system-updates', 'System updates', RefreshCw],
      ['/models/metadata', 'Models', Server],
      ['/rest-apis', 'REST API definitions', Network],
      ['/developer-docs', 'Developer documentation', BookOpen],
      ['/task-plugins', 'Task plugins', Puzzle],
      ['/users', 'Users', Users],
      ['/redemption-codes', 'Redemption codes', Gift],
      ['/subscriptions', 'Subscriptions', Wallet],
      ['/system-settings/site', 'Settings', Settings],
    ],
  },
]
function matchesSection(href: string, path: string) {
  const groups: Record<string, string> = { '/models/metadata': '/models/', '/ops/overview': '/ops/', '/system-settings/site': '/system-settings/' }
  const group = groups[href]
  return path === href || path.startsWith(`${href}/`) || (!!group && path.startsWith(group))
}
export function ConsoleShell({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    outerQueries = useQueryClient()
  const identity = JSON.stringify([auth.bundle?.user.id ?? null, auth.bundle?.session.sid ?? null])
  return (
    <ConsoleSession key={identity} outerQueries={outerQueries}>
      {children}
    </ConsoleSession>
  )
}
function ConsoleSession({ children, outerQueries }: { children: ReactNode; outerQueries: QueryClient }) {
  const [queries] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } } }))
  return (
    <QueryClientProvider client={queries}>
      <ConsoleShellContent outerQueries={outerQueries}>{children}</ConsoleShellContent>
    </QueryClientProvider>
  )
}
function ConsoleShellContent({ children, outerQueries }: { children: ReactNode; outerQueries: QueryClient }) {
  const auth = useAuth(),
    path = usePathname(),
    router = useRouter(),
    queries = useQueryClient(),
    { t, i18n } = useTranslation()
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean | null>(null)
  useEffect(() => {
    const wide = window.matchMedia('(min-width:901px)')
    const close = () => {
      if (wide.matches) setMobile(false)
    }
    wide.addEventListener('change', close)
    return () => wide.removeEventListener('change', close)
  }, [])
  useEffect(() => {
    const id = auth.bundle?.user.id
    const saved = id ? localStorage.getItem(`eva:sidebar:${id}`) : null
    setCollapsed(saved === null ? null : saved === 'true')
  }, [auth.bundle?.user.id])
  const self = useQuery({ queryKey: ['self', auth.bundle?.user.id], queryFn: () => api<User>('/api/user/self'), enabled: !!auth.bundle })
  const navigation = useQuery({
    queryKey: ['status'],
    queryFn: () => api<{ SidebarModulesAdmin?: string; default_collapse_sidebar?: boolean }>('/api/status'),
    staleTime: 60_000,
  })
  const user = self.data || auth.bundle?.user
  let preferredLanguage: string | undefined
  try {
    preferredLanguage = JSON.parse(user?.setting || '{}').language
  } catch {
    /* Native settings absent or from an older instance. */
  }
  useEffect(() => {
    if (!preferredLanguage) return
    let current = true
    void loadInterfaceLanguage(i18n, preferredLanguage)
      .then((language) => {
        if (!current) return
        void i18n.changeLanguage(language)
        persistInterfaceLanguage(language)
      })
      .catch(() => {
        if (current) toast.error(i18n.t('Could not load language'))
      })
    return () => {
      current = false
    }
  }, [user?.id, preferredLanguage, i18n])
  useEffect(() => {
    if (auth.phase === 'ready' && !auth.bundle) {
      const redirectPath = consoleReturnPath(path, window.location.search)
      router.replace(`/sign-in?redirect=${encodeURIComponent(redirectPath)}`)
    }
  }, [auth.phase, auth.bundle, path, router])
  async function signOut() {
    try {
      await logout()
      queries.clear()
      outerQueries.clear()
      router.replace('/sign-in')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }
  if (auth.phase === 'error') {
    return (
      <main className="page-container">
        <ErrorState error={new Error(auth.error)} retry={() => refreshSession().catch((error) => toast.error(t(error.message)))} />
      </main>
    )
  }
  if (!auth.bundle || !user) return <LoadingState />
  const isCollapsed = collapsed ?? navigation.data?.default_collapse_sidebar ?? false
  const label = (sections.flatMap((s) => s.items).find(([href]) => matchesSection(href as string, path))?.[1] as string) || 'Console'
  const visibleSections = sections
    .filter((section) => section.title !== 'Admin' || user.role >= 10)
    .map((section) => ({
      ...section,
      items: section.items.filter(([href]) => {
        const specialPages = ['/task-plugins', '/rest-apis', '/developer-docs']
        const isSpecialPage = specialPages.includes(href as string)
        return (!isSpecialPage || user.role === 100) && sidebarItemVisible(href as string, navigation.data?.SidebarModulesAdmin, user.sidebar_modules)
      }),
    }))
    .filter((section) => section.items.length > 0)
  const currentSection = sections.find((section) => section.items.some(([href]) => matchesSection(href as string, path)))?.title || 'General'

  return (
    <div className={`console-shell ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="console-sidebar">
        <ConsoleSidebarContent groups={visibleSections} user={user} />
      </aside>

      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent className="console-mobile-drawer translate-x-0 translate-y-0">
          <DialogTitle className="sr-only">{t('Main navigation')}</DialogTitle>
          <ConsoleSidebarContent groups={visibleSections} user={user} onNavigate={() => setMobile(false)} />
        </DialogContent>
      </Dialog>

      <div className="console-main">
        <header className="console-topbar">
          <Button
            className="desktop-sidebar-toggle"
            size="icon"
            variant="ghost"
            aria-label={t(isCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            aria-expanded={!isCollapsed}
            onClick={() => {
              const next = !isCollapsed
              setCollapsed(next)
              localStorage.setItem(`eva:sidebar:${user.id}`, String(next))
            }}
          >
            <Menu size={18} />
          </Button>

          <button className="icon-button mobile-menu" aria-label={t('Open menu')} aria-expanded={mobile} onClick={() => setMobile(true)}>
            <Menu size={18} />
          </button>

          <span className="console-breadcrumb">
            <span>
              {t(currentSection)} <span aria-hidden="true">›</span>
            </span>
            <strong>{t(label)}</strong>
          </span>

          <div className="console-topbar-actions">
            {user.role >= 10 && <SystemUpdateNotice userId={user.id} />}
            <LanguageSwitcher saveToAccount />
            <Link className="console-catalog-link" href="/pricing">
              {t('Model catalog')} ↗
            </Link>
            <Link href="/profile" className="avatar" aria-label={t('Profile')}>
              {(user.display_name || user.username).slice(0, 1).toUpperCase()}
            </Link>
            <button className="icon-button" aria-label={t('Sign out')} onClick={signOut}>
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <main id="content" className="console-content">
          {children}
        </main>
      </div>
    </div>
  )
}

function ConsoleSidebarContent({ groups, user, onNavigate }: { groups: typeof sections; user: User; onNavigate?: () => void }) {
  const { t } = useTranslation(),
    path = usePathname(),
    format = useQuotaFormatter()
  return (
    <>
      <Brand />
      {groups.map((section) => (
        <nav className="sidebar-group" aria-label={t(section.title)} key={section.title}>
          <span>{t(section.title)}</span>
          {section.items.map(([href, label, Icon]) => {
            const Graphic = Icon as typeof Activity
            return (
              <Link
                key={href as string}
                className="sidebar-link gap-3 px-3.5 py-2.5 text-sm font-medium transition-colors duration-150"
                data-active={matchesSection(href as string, path)}
                aria-current={matchesSection(href as string, path) ? 'page' : undefined}
                href={href as string}
                aria-label={t(label as string)}
                title={t(label as string)}
                onClick={onNavigate}
              >
                <Graphic className="shrink-0" />
                <span className="sidebar-label truncate">{t(label as string)}</span>
              </Link>
            )
          })}
        </nav>
      ))}
      <div className="sidebar-group">
        <Link className="sidebar-link" href="/docs" aria-label={t('Docs')} title={t('Docs')} onClick={onNavigate}>
          <BookOpen size={15} />
          <span className="sidebar-label">{t('Docs')}</span>
        </Link>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-balance">
          <span>{t('Account balance')}</span>
          <strong>{format(user.quota)}</strong>
        </div>
        <Link className="sidebar-link" href="/wallet" onClick={onNavigate}>
          {t('Recharge')}
          <ArrowUpRight size={13} />
        </Link>
        <small className="small-note">New API / QuantumNous</small>
      </div>
    </>
  )
}
