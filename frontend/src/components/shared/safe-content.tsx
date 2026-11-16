import 'server-only'
import { contentHtml } from '@/lib/content-html'
export function SafeContent({ source }: { source: string }) {
  return (
    <div
      className="site-rich-content max-w-none text-sm leading-relaxed text-foreground/90 [&_a]:text-primary [&_a:hover]:underline [&_p]:leading-relaxed"
      dangerouslySetInnerHTML={{ __html: contentHtml(source) }}
    />
  )
}
