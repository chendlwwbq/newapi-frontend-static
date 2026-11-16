import { contentHtml } from '@/lib/content-html'

// Stateless formatting only: no private data, persistence, upstream calls or credentials.
export async function POST(request: Request) {
  const source = await request.text()
  if (source.length > 100_000) return Response.json({ error: 'Content is too long' }, { status: 413 })
  return Response.json({ html: contentHtml(source) }, { headers: { 'Cache-Control': 'no-store' } })
}
