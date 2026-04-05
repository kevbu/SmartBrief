import { scoreByImportance } from './importance-score'
import type { Article } from '@/types'

function makeArticle(overrides: Partial<Article> & { publishedAt: Date | string }): Article {
  return {
    id: 'a1',
    title: 'Test',
    description: null,
    content: null,
    url: 'https://example.com/a1',
    imageUrl: null,
    source: 'Test Source',
    sourceUrl: null,
    category: 'technology',
    sentiment: 'neutral',
    sentimentScore: 0.5,
    isRead: false,
    isSaved: false,
    fetchedAt: new Date(),
    ...overrides,
  }
}

const NOW = new Date('2026-04-04T12:00:00Z')

describe('scoreByImportance', () => {
  it('returns empty array for no input', () => {
    expect(scoreByImportance([], NOW)).toEqual([])
  })

  it('scores a brand-new article higher than an older one', () => {
    const fresh = makeArticle({ id: 'fresh', publishedAt: new Date('2026-04-04T10:00:00Z'), sentimentScore: 0.5 })
    const old = makeArticle({ id: 'old', publishedAt: new Date('2026-04-01T10:00:00Z'), sentimentScore: 0.5 })
    const result = scoreByImportance([old, fresh], NOW)
    expect(result[0].id).toBe('fresh')
    expect(result[0].importanceScore).toBeGreaterThan(result[1].importanceScore)
  })

  it('uses sentiment magnitude — higher |sentimentScore| wins', () => {
    const highSentiment = makeArticle({ id: 'high', publishedAt: NOW, sentimentScore: 0.9 })
    const lowSentiment = makeArticle({ id: 'low', publishedAt: NOW, sentimentScore: 0.2 })
    const result = scoreByImportance([lowSentiment, highSentiment], NOW)
    expect(result[0].id).toBe('high')
  })

  it('treats negative sentimentScore by magnitude', () => {
    const negative = makeArticle({ id: 'neg', publishedAt: NOW, sentimentScore: -0.8 })
    const positive = makeArticle({ id: 'pos', publishedAt: NOW, sentimentScore: 0.5 })
    const result = scoreByImportance([positive, negative], NOW)
    expect(result[0].id).toBe('neg')
    expect(result[0].importanceScore).toBeGreaterThan(result[1].importanceScore)
  })

  it('applies 0.7 category boost to second article in same category', () => {
    const a1 = makeArticle({ id: 'a1', category: 'technology', publishedAt: NOW, sentimentScore: 0.8 })
    const a2 = makeArticle({ id: 'a2', category: 'technology', publishedAt: NOW, sentimentScore: 0.8 })
    const result = scoreByImportance([a1, a2], NOW)
    // Both same recency, same magnitude — first gets 1.0 boost, second 0.7
    expect(result[0].importanceScore).toBeCloseTo(0.8)
    expect(result[1].importanceScore).toBeCloseTo(0.8 * 0.7)
  })

  it('first article in each distinct category gets full boost', () => {
    const tech = makeArticle({ id: 'tech', category: 'technology', publishedAt: NOW, sentimentScore: 0.6 })
    const sci = makeArticle({ id: 'sci', category: 'science', publishedAt: NOW, sentimentScore: 0.6 })
    const result = scoreByImportance([tech, sci], NOW)
    // Both first in their category — same importance score
    expect(result[0].importanceScore).toBeCloseTo(result[1].importanceScore)
  })

  it('recency decay: 2-day-old article scores ~50% of brand-new', () => {
    const fresh = makeArticle({ id: 'fresh', publishedAt: NOW, sentimentScore: 1.0 })
    const twoDaysAgo = makeArticle({
      id: 'old',
      publishedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
      sentimentScore: 1.0,
    })
    const result = scoreByImportance([fresh, twoDaysAgo], NOW)
    const freshScore = result.find((r) => r.id === 'fresh')!.importanceScore
    const oldScore = result.find((r) => r.id === 'old')!.importanceScore
    // e^(-2/2) = e^-1 ≈ 0.368 — different categories each get full boost
    expect(oldScore / freshScore).toBeCloseTo(Math.exp(-1), 2)
  })
})
