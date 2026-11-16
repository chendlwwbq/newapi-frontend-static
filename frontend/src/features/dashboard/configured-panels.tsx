'use client'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api/client'
import { CopyButton } from '@/components/shared/copy-button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { ServiceStatus } from './service-status'
import { toIntlLocale } from '@/i18n/languages'

type ConsoleContent = {
  announcements_enabled: boolean
  faq_enabled: boolean
  api_info_enabled: boolean
  uptime_kuma_enabled: boolean
  announcements?: { id: number; content: string; publishDate: string; type: string; extra?: string }[]
  faq?: { id: number; question: string; answer: string }[]
  api_info?: { id: number; url: string; route: string; description: string }[]
}
export function AnnouncementItem({ item }: { item: NonNullable<ConsoleContent['announcements']>[number] }) {
  const { i18n } = useTranslation()
  const date = new Date(item.publishDate)
  return (
    <article>
      <p>{item.content}</p>
      <span className="small-note">
        {Number.isNaN(date.getTime()) ? item.publishDate : date.toLocaleDateString(toIntlLocale(i18n.resolvedLanguage || i18n.language))}
      </span>
      {item.extra && <p>{item.extra}</p>}
    </article>
  )
}
export function FaqItem({ item }: { item: NonNullable<ConsoleContent['faq']>[number] }) {
  return (
    <details>
      <summary>{item.question}</summary>
      <p>{item.answer}</p>
    </details>
  )
}
export function ApiInfoItem({ item }: { item: NonNullable<ConsoleContent['api_info']>[number] }) {
  return (
    <article>
      <p>{item.description}</p>
      <span className="small-note">{item.route}</span>
      <div className="action-buttons">
        <code className="admin-models">{item.url}</code>
        <CopyButton value={item.url} />
      </div>
    </article>
  )
}
export function ConfiguredPanels({ apiOnly = false }: { apiOnly?: boolean }) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => api<ConsoleContent>('/api/status', { signal, anonymous: true }),
    staleTime: 60_000,
  })
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  if (query.isPending) return <LoadingState />
  const content = query.data
  const apiPanel = (
    <section className="console-panel">
      <h2>{t('API information')}</h2>
      {content.api_info_enabled && content.api_info?.length ? (
        <div className="console-notice-list">
          {content.api_info.map((item) => (
            <ApiInfoItem key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  )
  if (apiOnly) return apiPanel
  return (
    <div className="overview-configured">
      {content.api_info_enabled && apiPanel}
      {content.announcements_enabled && (
        <section className="console-panel">
          <h2>{t('Announcements')}</h2>
          {content.announcements?.length ? (
            <div className="console-notice-list">
              {content.announcements.map((item) => (
                <AnnouncementItem key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      )}
      {content.uptime_kuma_enabled && <ServiceStatus enabled />}
      {content.faq_enabled && !!content.faq?.length && (
        <section className="console-panel">
          <h2>{t('Frequently asked questions')}</h2>
          <div className="console-notice-list">
            {content.faq.map((item) => (
              <FaqItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
