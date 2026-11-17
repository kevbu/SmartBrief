import type { TopStory as TopStoryRow } from '@prisma/client'
import {
  articleOverlap,
  filterTopStoriesForFeed,
  matchRebuiltClusters,
  parseArticleIds,
  selectCurrentBatch,
  sortBySavedAt,
  toTopStory,
} from './top-stories'

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
    savedAt: null,
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

  it('passes savedAt through', () => {
    const savedAt = new Date('2026-11-17T08:00:00Z')
    expect(toTopStory(makeRow({ saved: true, savedAt })).savedAt).toEqual(savedAt)
    expect(toTopStory(makeRow()).savedAt).toBeNull()
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

describe('parseArticleIds', () => {
  it('parses a JSON string array', () => {
    expect(parseArticleIds('["a","b"]')).toEqual(['a', 'b'])
  })

  it('returns [] for null, malformed or non-array JSON', () => {
    expect(parseArticleIds(null)).toEqual([])
    expect(parseArticleIds('{')).toEqual([])
    expect(parseArticleIds('{"a":1}')).toEqual([])
  })

  it('drops non-string entries', () => {
    expect(parseArticleIds('["a",1,null,"b"]')).toEqual(['a', 'b'])
  })
})

describe('filterTopStoriesForFeed', () => {
  const story = (id: string, title: string, sources: string[]) => ({ id, title, sources })
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

  it('returns all stories when no filters are set', () => {
    const rows = [story('a', 'Anything', ['BBC'])]
    expect(filterTopStoriesForFeed(rows, [], [])).toEqual(rows)
  })

  it('drops a cluster when every source is hidden (case-insensitive)', () => {
    const rows = [story('all-hidden', 'Story', ['Daily Mail', 'BILD']), story('ok', 'Story', ['BBC'])]
    expect(ids(filterTopStoriesForFeed(rows, ['daily mail', 'bild'], []))).toEqual(['ok'])
  })

  it('keeps a cluster with partial hidden-source overlap', () => {
    const rows = [story('mixed', 'Story', ['Daily Mail', 'Reuters'])]
    expect(ids(filterTopStoriesForFeed(rows, ['daily mail'], []))).toEqual(['mixed'])
  })

  it('keeps a cluster with no sources', () => {
    const rows = [story('empty', 'Story', [])]
    expect(ids(filterTopStoriesForFeed(rows, ['bbc'], []))).toEqual(['empty'])
  })

  it('drops a cluster whose title contains an avoid topic, any case', () => {
    const rows = [
      story('crypto', 'Bitcoin hits new high', ['Reuters']),
      story('other', 'Rain in Munich', ['BR']),
    ]
    expect(ids(filterTopStoriesForFeed(rows, [], ['bitcoin']))).toEqual(['other'])
  })

  it('applies both rules together', () => {
    const rows = [
      story('hidden', 'Weather', ['Bild']),
      story('topic', 'Election results', ['BBC']),
      story('ok', 'Weather', ['BBC']),
    ]
    expect(ids(filterTopStoriesForFeed(rows, ['bild'], ['election']))).toEqual(['ok'])
  })
})

describe('articleOverlap', () => {
  it('uses the smaller set as denominator', () => {
    expect(articleOverlap(['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e', 'f'])).toEqual({
      shared: 3,
      coefficient: 1,
    })
  })

  it('ignores duplicate ids', () => {
    expect(articleOverlap(['a', 'a', 'b'], ['a', 'b'])).toEqual({ shared: 2, coefficient: 1 })
  })

  it('returns zero for empty lists', () => {
    expect(articleOverlap([], ['a'])).toEqual({ shared: 0, coefficient: 0 })
  })
})

describe('matchRebuiltClusters', () => {
  it('matches a rebuilt cluster that grew around the saved one', () => {
    const saved = [{ id: 's1', articleIds: ['a', 'b', 'c'] }]
    const fresh = [{ articleIds: ['x', 'y'] }, { articleIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }]
    expect(matchRebuiltClusters(fresh, saved)).toEqual(new Map([[1, 's1']]))
  })

  it('does not match on a single shared article', () => {
    const saved = [{ id: 's1', articleIds: ['a', 'b'] }]
    const fresh = [{ articleIds: ['a', 'z'] }]
    expect(matchRebuiltClusters(fresh, saved).size).toBe(0)
  })

  it('does not match below the coefficient threshold (2 of 5 = 0.4)', () => {
    const saved = [{ id: 's1', articleIds: ['a', 'b', 'c', 'd', 'e'] }]
    const fresh = [{ articleIds: ['a', 'b', 'v', 'w', 'x'] }]
    expect(matchRebuiltClusters(fresh, saved).size).toBe(0)
  })

  it('matches at the threshold (3 of 5 = 0.6)', () => {
    const saved = [{ id: 's1', articleIds: ['a', 'b', 'c', 'd', 'e'] }]
    const fresh = [{ articleIds: ['a', 'b', 'c', 'w', 'x'] }]
    expect(matchRebuiltClusters(fresh, saved)).toEqual(new Map([[0, 's1']]))
  })

  it('assigns one-to-one, best overlap wins', () => {
    const saved = [{ id: 's1', articleIds: ['a', 'b', 'c', 'd'] }]
    const fresh = [
      { articleIds: ['a', 'b', 'c', 'x'] }, // 0.75
      { articleIds: ['a', 'b', 'c', 'd'] }, // 1.0
    ]
    expect(matchRebuiltClusters(fresh, saved)).toEqual(new Map([[1, 's1']]))
  })

  it('prefers the grown continuation over a small fragment of the saved cluster', () => {
    const savedIds = Array.from({ length: 20 }, (_, i) => `s${i + 1}`)
    const saved = [{ id: 's1', articleIds: savedIds }]
    const fragment = { articleIds: ['s1', 's2'] } // coefficient 1.0, shared 2
    const continuation = {
      // shared 14 (s3..s16), coefficient 14/20 = 0.7
      articleIds: [...savedIds.slice(2, 16), ...Array.from({ length: 10 }, (_, i) => `n${i}`)],
    }
    expect(matchRebuiltClusters([fragment, continuation], saved)).toEqual(new Map([[1, 's1']]))
  })

  it('lets one new cluster absorb only one of two saved duplicates', () => {
    const saved = [
      { id: 's1', articleIds: ['a', 'b', 'c'] },
      { id: 's2', articleIds: ['a', 'b', 'c'] },
    ]
    const fresh = [{ articleIds: ['a', 'b', 'c', 'd'] }]
    expect(matchRebuiltClusters(fresh, saved)).toEqual(new Map([[0, 's1']]))
  })

  it('returns an empty map when nothing is saved', () => {
    expect(matchRebuiltClusters([{ articleIds: ['a', 'b'] }], []).size).toBe(0)
  })
})

describe('sortBySavedAt', () => {
  const at = (iso: string) => new Date(iso)

  it('puts the most recently saved first', () => {
    const rows = [
      { id: 'old', savedAt: at('2026-11-10T00:00:00Z') },
      { id: 'new', savedAt: at('2026-11-17T00:00:00Z') },
      { id: 'mid', savedAt: at('2026-11-14T00:00:00Z') },
    ]
    expect(sortBySavedAt(rows).map((r) => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('keeps null savedAt rows after dated rows, in input order', () => {
    const rows = [
      { id: 'legacy1', savedAt: null },
      { id: 'dated', savedAt: at('2026-11-01T00:00:00Z') },
      { id: 'legacy2', savedAt: null },
    ]
    expect(sortBySavedAt(rows).map((r) => r.id)).toEqual(['dated', 'legacy1', 'legacy2'])
  })

  it('does not mutate the input', () => {
    const rows: { id: string; savedAt: Date | null }[] = [
      { id: 'a', savedAt: null },
      { id: 'b', savedAt: at('2026-11-01T00:00:00Z') },
    ]
    sortBySavedAt(rows)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
  })
})
