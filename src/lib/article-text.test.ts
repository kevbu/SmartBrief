import { extractArticleBody, pickArticleText } from './article-text'
import { isPremiumItem } from './news-fetcher'
import { wantsFullText } from './article-enricher'

const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`

describe('extractArticleBody', () => {
  it('reads articleBody from a NewsArticle block', () => {
    const html = `<html>${ld({ '@type': 'NewsArticle', articleBody: 'Berlin. Erster Absatz.' })}</html>`
    expect(extractArticleBody(html)).toBe('Berlin. Erster Absatz.')
  })

  it('finds the body inside @graph and arrays and picks the longest', () => {
    const html =
      ld([{ '@type': 'BreadcrumbList' }, { '@type': 'NewsArticle', articleBody: 'kurz' }]) +
      ld({ '@graph': [{ '@type': 'NewsArticle', articleBody: 'deutlich längerer Text' }] })
    expect(extractArticleBody(html)).toBe('deutlich längerer Text')
  })

  it('strips tags and entities and keeps paragraph breaks', () => {
    const html = ld({ articleBody: '<p>A &amp; B</p>\n\n  <p>C&nbsp;D</p>' })
    expect(extractArticleBody(html)).toBe('A & B\nC D')
  })

  it('returns null for broken JSON or no body', () => {
    expect(extractArticleBody('<script type="application/ld+json">{oops</script>')).toBeNull()
    expect(extractArticleBody(ld({ '@type': 'WebPage' }))).toBeNull()
    expect(extractArticleBody('<html></html>')).toBeNull()
  })
})

describe('pickArticleText', () => {
  const desc = 'Teaser text.'
  it('prefers content when it adds real text', () => {
    const content = 'x'.repeat(200)
    expect(pickArticleText({ description: desc, content }, 1000)).toBe(content)
  })

  it('keeps the description when content is only the teaser again', () => {
    expect(pickArticleText({ description: desc, content: 'Teaser text. Mehr' }, 1000)).toBe(desc)
  })

  it('falls back to content when there is no description', () => {
    expect(pickArticleText({ description: null, content: 'nur content' }, 1000)).toBe('nur content')
  })

  it('caps the length', () => {
    const out = pickArticleText({ description: null, content: 'a'.repeat(500) }, 100)
    expect(out).toBe(`${'a'.repeat(100)} …`)
  })

  it('returns an empty string when nothing is there', () => {
    expect(pickArticleText({ description: null, content: null }, 100)).toBe('')
  })
})

describe('isPremiumItem', () => {
  it('detects the Handelsblatt H_PLUS marker', () => {
    const item = {
      mediaCategories: [{ _: 'Politik', $: { label: 'ressort' } }, { _: 'H_PLUS', $: { label: 'accessCategory' } }],
    }
    expect(isPremiumItem(item)).toBe(true)
  })

  it('is false for free items and missing data', () => {
    expect(isPremiumItem({ mediaCategories: [{ _: 'NONE', $: { label: 'accessCategory' } }] })).toBe(false)
    expect(isPremiumItem({ mediaCategories: ['H_PLUS'] })).toBe(false)
    expect(isPremiumItem({})).toBe(false)
  })
})

describe('wantsFullText', () => {
  it('only targets fullText sources with web URLs', () => {
    expect(wantsFullText({ source: 'Handelsblatt', url: 'https://www.handelsblatt.com/a/1.html' })).toBe(true)
    expect(wantsFullText({ source: 'Handelsblatt', url: 'newsletter://x' })).toBe(false)
    expect(wantsFullText({ source: 'Süddeutsche Zeitung', url: 'https://www.sueddeutsche.de/a' })).toBe(false)
  })
})
