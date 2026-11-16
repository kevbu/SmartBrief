import type { TopStory as TopStoryRow } from '@prisma/client'
import { selectCurrentBatch, toTopStory } from './top-stories'

function makeRow(overrides: Partial<TopStoryRow> = {}): TopStoryRow {
  return {
    id: 'ts1',
    title: 'Cluster',
    summary: 'Summary',
    category: 'technology',
    articleIds: '["a1","a2"]',
    sources: '["BBC","Reuters"]',
    sentiment: 'neutral',
    bullets: '["one","two"]',
    clusterArticles: null,
    saved: false,
    createdAt: new Date('2026-11-16T10:00:00Z'),
    ...overrides,
  }
}

const OLD = new Date('2026-11-15T10:00:00Z')
const NEW = new Date('2026-11-16T10:00:00Z')

describe('toTopStory', () => {
  it('parses JSON columns and keeps the saved flag', () => {
    const story = toTopStory(makeRow({ saved: true }))
    expect(story.articleIds).toEqual(['a1', 'a2'])
    expect(story.sources).toEqual(['BBC', 'Reuters'])
    expect(story.bullets).toEqual(['one', 'two'])
    expect(story.clusterArticles).toBeUndefined()
    expect(story.saved).toBe(true)
  })

  it('returns false for unsaved rows', () => {
    expect(toTopStory(makeRow()).saved).toBe(false)
  })

  it('falls back on malformed JSON', () => {
    const story = toTopStory(
      makeRow({ articleIds: 'not json', sources: '{', bullets: '[', clusterArticles: 'x' })
    )
    expect(story.articleIds).toEqual([])
    expect(story.sources).toEqual([])
    expect(story.bullets).toBeUndefined()
    expect(story.clusterArticles).toBeUndefined()
  })
})

describe('selectCurrentBatch', () => {
  it('returns empty array for no input', () => {
    expect(selectCurrentBatch([])).toEqual([])
  })

  it('keeps only rows with the newest createdAt', () => {
    const rows = [
      makeRow({ id: 'new1', createdAt: NEW }),
      makeRow({ id: 'old', createdAt: OLD }),
      makeRow({ id: 'new2', createdAt: new Date(NEW) }),
    ]
    expect(selectCurrentBatch(rows).map((r) => r.id)).toEqual(['new1', 'new2'])
  })

  it('excludes a saved row from an older batch', () => {
    const rows = [
      makeRow({ id: 'current', createdAt: NEW }),
      makeRow({ id: 'saved-old', createdAt: OLD, saved: true }),
    ]
    expect(selectCurrentBatch(rows).map((r) => r.id)).toEqual(['current'])
  })

  it('keeps a saved row that belongs to the newest batch', () => {
    const rows = [
      makeRow({ id: 'current', createdAt: NEW }),
      makeRow({ id: 'saved-current', createdAt: NEW, saved: true }),
    ]
    expect(selectCurrentBatch(rows).map((r) => r.id)).toEqual(['current', 'saved-current'])
  })
})
