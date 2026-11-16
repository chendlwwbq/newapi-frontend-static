import { describe, expect, it } from 'vitest'
import { contentHtml } from '../content-html'
import { homeFrameURL } from '../configured-content'
describe('configured public content', () => {
  it('renders Markdown headings, links, lists and inline HTML', () => {
    const html = contentHtml('# eva\n\n- **One**\n- <em>Two</em>\n\n[Docs](/docs)')
    expect(html).toContain('<h1>eva</h1>')
    expect(html).toContain('<strong>One</strong>')
    expect(html).toContain('<em>Two</em>')
    expect(html).toContain('href="/docs"')
  })
  it.each([
    '<script>window.evaInjected=true</script><p>Safe</p>',
    '<img src="/logo.png" onerror="window.evaInjected=true">',
    '<a href="javascript:alert(1)">Docs</a><a href="data:text/html,test">Data</a>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe><form action="/api/user/login"><input name="password"></form>',
    '<style>body{display:none}</style><div style="position:fixed" onclick="alert(1)">Safe</div>',
  ])('removes executable content and page controls: %s', (source) => {
    const html = contentHtml(source)
    expect(html).not.toMatch(/<script|<iframe|<form|<input|<style|onerror|onclick|srcdoc|javascript:|data:text|style=/i)
    expect(html).not.toContain('window.evaInjected')
  })
  it('uses the same explicit HTTPS frame mode for home content and its draft preview', () => {
    expect(homeFrameURL('  https://example.com/docs?q=eva#intro  ')).toBe('https://example.com/docs?q=eva#intro')
    for (const source of ['http://example.com', 'https://user:pass@example.com', '# eva', 'https://example.com\ntext', 'https://'])
      expect(homeFrameURL(source)).toBeNull()
  })
})
