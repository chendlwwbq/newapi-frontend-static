import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

// Keep parsing on the server; configuration must not become executable page code.
export function contentHtml(source: string): string {
  return sanitizeHtml(marked.parse(source, { async: false }), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height', 'loading'], '*': ['id'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: { img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }) },
  })
}
