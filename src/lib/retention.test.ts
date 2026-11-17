import {
  DEFAULT_RETENTION_DAYS,
  chunk,
  collectProtectedArticleIds,
  feedbackCutoff,
  isPrunable,
  parseRetentionDays,
  retentionCutoff,
  selectArticlesToPrune,
  selectOrphanedFeedbackArticleIds,
  shouldIngest,
  type PruneCandidate,
} from './retention'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-17T12:00:00Z')
const CUTOFF = retentionCutoff(NOW, 30)
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY)

function candidate(overrides: Partial<PruneCandidate> = {}): PruneCandidate {
  return {
    id: 'a1',
    isSaved: false,
    publishedAt: daysAgo(60),
    fetchedAt: daysAgo(60),
    readAt: null,
    ...overrides,
  }
}

describe('parseRetentionDays', () => {
  it('defaults to 30 when unset or empty', () => {
    expect(parseRetentionDays(undefined)).toEqual({ days: DEFAULT_RETENTION_DAYS, valid: true })
    expect(parseRetentionDays('')).toEqual({ days: 30, valid: true })
    expect(parseRetentionDays('   ')).toEqual({ days: 30, valid: true })
  })

  it('accepts non-negative integers, trimmed', () => {
    expect(parseRetentionDays('7')).toEqual({ days: 7, valid: true })
    expect(parseRetentionDays(' 90 ')).toEqual({ days: 90, valid: true })
  })

  it('treats 0 as off', () => {
    expect(parseRetentionDays('0')).toEqual({ days: 0, valid: true })
  })

  it('falls back to the default for invalid values', () => {
    for (const raw of ['abc', '-5', '1.5', '30d', 'NaN']) {
      expect(parseRetentionDays(raw)).toEqual({ days: 30, valid: false })
    }
  })
})

describe('retentionCutoff / feedbackCutoff', () => {
  it('subtracts whole days', () => {
    expect(retentionCutoff(NOW, 30).toISOString()).toBe('2026-10-18T12:00:00.000Z')
  })

  it('keeps feedback at least 30 days even with a shorter window', () => {
    expect(feedbackCutoff(NOW, 7)).toEqual(retentionCutoff(NOW, 30))
    expect(feedbackCutoff(NOW, 90)).toEqual(retentionCutoff(NOW, 90))
  })
})

describe('shouldIngest', () => {
  it('keeps everything when retention is off', () => {
    expect(shouldIngest(daysAgo(400), null)).toBe(true)
  })

  it('skips items published before the cutoff', () => {
    expect(shouldIngest(daysAgo(31), CUTOFF)).toBe(false)
    expect(shouldIngest(CUTOFF, CUTOFF)).toBe(true)
    expect(shouldIngest(daysAgo(1), CUTOFF)).toBe(true)
  })

  it('keeps items with an invalid date', () => {
    expect(shouldIngest(new Date('not a date'), CUTOFF)).toBe(true)
  })
})

describe('collectProtectedArticleIds', () => {
  it('unions articleIds of all clusters', () => {
    const { ids, unparseable } = collectProtectedArticleIds([
      { articleIds: '["a1","a2"]' },
      { articleIds: '["a2","a3"]' },
      { articleIds: '[]' },
      { articleIds: null },
      { articleIds: '' },
    ])
    expect([...ids].sort()).toEqual(['a1', 'a2', 'a3'])
    expect(unparseable).toBe(0)
  })

  it('counts clusters whose articleIds cannot be read (caller fails closed)', () => {
    const { ids, unparseable } = collectProtectedArticleIds([
      { articleIds: '["a1"]' },
      { articleIds: 'not json' },
      { articleIds: '{"a":1}' },
    ])
    expect([...ids]).toEqual(['a1'])
    expect(unparseable).toBe(2)
  })
})

describe('isPrunable', () => {
  const none = new Set<string>()

  it('prunes an old, unsaved, unreferenced, unread article', () => {
    expect(isPrunable(candidate(), none, CUTOFF)).toBe(true)
  })

  it('keeps saved articles', () => {
    expect(isPrunable(candidate({ isSaved: true }), none, CUTOFF)).toBe(false)
  })

  it('keeps articles referenced by a cluster', () => {
    expect(isPrunable(candidate(), new Set(['a1']), CUTOFF)).toBe(false)
  })

  it('keeps articles published inside the window', () => {
    expect(isPrunable(candidate({ publishedAt: daysAgo(5) }), none, CUTOFF)).toBe(false)
  })

  it('keeps articles fetched inside the window', () => {
    expect(isPrunable(candidate({ fetchedAt: daysAgo(5) }), none, CUTOFF)).toBe(false)
  })

  it('keeps articles read inside the window, prunes ones read before it', () => {
    expect(isPrunable(candidate({ readAt: daysAgo(5) }), none, CUTOFF)).toBe(false)
    expect(isPrunable(candidate({ readAt: daysAgo(40) }), none, CUTOFF)).toBe(true)
  })

  it('treats the cutoff instant as inside the window', () => {
    expect(isPrunable(candidate({ publishedAt: CUTOFF }), none, CUTOFF)).toBe(false)
  })
})

describe('selectArticlesToPrune', () => {
  it('returns only prunable ids in input order', () => {
    const ids = selectArticlesToPrune(
      [
        candidate({ id: 'old' }),
        candidate({ id: 'saved', isSaved: true }),
        candidate({ id: 'in-cluster' }),
        candidate({ id: 'recent', publishedAt: daysAgo(1), fetchedAt: daysAgo(1) }),
        candidate({ id: 'old2' }),
      ],
      new Set(['in-cluster']),
      CUTOFF
    )
    expect(ids).toEqual(['old', 'old2'])
  })
})

describe('selectOrphanedFeedbackArticleIds', () => {
  it('returns deduped ids whose article is gone', () => {
    expect(
      selectOrphanedFeedbackArticleIds(['a1', 'a2', 'a1', 'a3'], new Set(['a2']))
    ).toEqual(['a1', 'a3'])
  })
})

describe('chunk', () => {
  it('splits into fixed-size slices', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })

  it('rejects a size below 1', () => {
    expect(() => chunk([1], 0)).toThrow()
  })
})
