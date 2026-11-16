import { describe, expect, it } from 'vitest'
import { validateSettingsCollection } from './settings-collections'

const draft = { id: 1, slug: 'first-article', title: 'Draft', body: '', excerpt: '', status: 'draft', published_at: '' }
describe('news publication drafts', () => {
  it('allows incomplete content to stay in a private draft', () => {
    expect(() => validateSettingsCollection('EvaNewsArticles', [draft])).not.toThrow()
  })
  it('requires content and a real date before publication', () => {
    expect(() => validateSettingsCollection('EvaNewsArticles', [{ ...draft, status: 'published' }])).toThrow(
      'Published articles need content and a publish date'
    )
    expect(() =>
      validateSettingsCollection('EvaNewsArticles', [{ ...draft, status: 'published', body: 'Article', published_at: 'invalid' }])
    ).toThrow('Invalid news publish date')
    expect(() =>
      validateSettingsCollection('EvaNewsArticles', [{ ...draft, status: 'published', body: 'Article', published_at: '2026-10-26T12:00:00Z' }])
    ).not.toThrow()
  })
  it('rejects duplicate identifiers and unsafe article paths', () => {
    for (const row of [
      { ...draft, id: 2 },
      { ...draft, slug: 'other' },
      { ...draft, id: 2, slug: '../private' },
    ])
      expect(() => validateSettingsCollection('EvaNewsArticles', [draft, row])).toThrow()
  })
})
