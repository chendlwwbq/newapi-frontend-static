import 'server-only'
import { contentHtml } from '@/lib/content-html'
export function SafeContent({ source }: { source: string }) {
  return <div className="site-rich-content" dangerouslySetInnerHTML={{ __html: contentHtml(source) }} />
}
