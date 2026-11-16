import { guides, toolGuides, toolNames } from './guides'
import type { PublishedDocSummary } from '@/features/developer/published-documentation'

export type DocEntry = { id: string; href: string; title: string; description: string; category: string; keywords: string[] }
export const docsCatalog: DocEntry[] = [
  ...Object.entries(guides).map(([id, guide]) => ({
    id,
    href: `/docs/${id}`,
    title: guide.title,
    description: guide.intro,
    category: id === 'errors' ? 'Troubleshooting' : 'Integration guides',
    keywords: guide.sections.flatMap((section) => [
      section.title,
      section.text,
      ...(section.metrics?.flatMap((metric) => [metric.name, metric.description]) || []),
    ]),
  })),
  ...Object.entries(toolNames)
    .filter(([id]) => !['claudecode', 'codex'].includes(id))
    .map(([id, title]) => ({
      id,
      href: `/docs/${id}`,
      title,
      description: toolGuides[id]?.intro || 'Connection settings',
      category: 'Clients',
      keywords:
        toolGuides[id]?.sections.flatMap((section) => [
          section.title,
          section.text,
          ...(section.metrics?.flatMap((metric) => [metric.name, metric.description]) || []),
        ]) || [],
    })),
]
export function publishedDocsToEntries(docs: PublishedDocSummary[]): DocEntry[] {
  return docs.map((doc) => ({
    id: `published:${doc.id}`,
    href: `/docs/published/${encodeURIComponent(doc.slug)}`,
    title: doc.title,
    description: doc.summary,
    category: 'Developer documentation',
    keywords: [doc.slug, doc.language],
  }))
}
/** Match every query term against visible translated text as well as source terminology. */
export function searchDocs(query: string, translate: (key: string) => string, entries = docsCatalog): DocEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return entries
  return entries.filter((entry) => {
    const text = [entry.title, entry.description, entry.category, ...entry.keywords, entry.id]
      .flatMap((value) => [value, translate(value)])
      .join(' ')
      .toLowerCase()
    return terms.every((term) => text.includes(term))
  })
}
