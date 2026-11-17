import { describe, expect, it } from 'vitest'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  buildBackup,
  coerceRow,
  collectReferencedArticleIds,
  findSchemaViolation,
  parseArticleIds,
  planArticleMerge,
  planKeyedUpserts,
  planTopStoryMerge,
  validateBackup,
  type BackupData,
  type BackupRow,
  type FieldSpec,
} from './backup'

const NOW = new Date('2026-11-17T08:00:00.000Z')

function article(id: string, url: string, extra: BackupRow = {}): BackupRow {
  return { id, url, title: `T ${id}`, isSaved: false, publishedAt: '2026-11-10T10:00:00.000Z', ...extra }
}

function story(id: string, articleIds: string[], extra: BackupRow = {}): BackupRow {
  return { id, title: `S ${id}`, articleIds: JSON.stringify(articleIds), saved: true, ...extra }
}

function sampleData(): BackupData {
  return {
    preferences: { id: 'default', moodPreset: 'balanced', sessionSize: 15 },
    sourceWeights: [{ id: 'c1', source: 'BBC', weight: 1.2 }],
    topicWeights: [{ id: 'c2', topic: 'science', weight: 0.8 }],
    savedArticles: [article('a1', 'https://x/1', { isSaved: true })],
    savedTopStories: [story('s1', ['a1', 'a2'])],
    referencedArticles: [article('a2', 'https://x/2')],
  }
}

/** JSON round trip, as the file goes through download and upload. */
function roundTrip<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe('buildBackup', () => {
  it('stamps format, version and export time', () => {
    const backup = buildBackup(sampleData(), NOW)
    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backup.exportedAt).toBe(NOW.toISOString())
  })

  it('round-trips through JSON and validation', () => {
    const result = validateBackup(roundTrip(buildBackup(sampleData(), NOW)))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.backup.data.savedTopStories).toHaveLength(1)
  })

  it('contains no secret-looking keys', () => {
    const json = JSON.stringify(buildBackup(sampleData(), NOW))
    for (const key of ['vapid', 'p256dh', 'endpoint', 'imap', 'password', '"auth"']) {
      expect(json.toLowerCase()).not.toContain(key.toLowerCase())
    }
  })
})

describe('backupFilename', () => {
  it('uses the export date', () => {
    expect(backupFilename(NOW)).toBe('smartbrief-backup-2026-11-17.json')
  })
})

describe('parseArticleIds / collectReferencedArticleIds', () => {
  it('parses JSON strings and arrays, tolerates junk', () => {
    expect(parseArticleIds('["a","b"]')).toEqual(['a', 'b'])
    expect(parseArticleIds(['a', 3, 'b'])).toEqual(['a', 'b'])
    expect(parseArticleIds('not json')).toEqual([])
    expect(parseArticleIds(null)).toEqual([])
  })

  it('returns referenced ids not already saved, deduplicated', () => {
    const stories = [story('s1', ['a1', 'a2']), story('s2', ['a2', 'a3'])]
    expect(collectReferencedArticleIds(stories, ['a1']).sort()).toEqual(['a2', 'a3'])
  })
})

describe('validateBackup', () => {
  const valid = () => roundTrip(buildBackup(sampleData(), NOW)) as Record<string, unknown>

  it('rejects non-objects and foreign files', () => {
    expect(validateBackup(null)).toMatchObject({ ok: false })
    expect(validateBackup([])).toMatchObject({ ok: false })
    expect(validateBackup({ ...valid(), format: 'other' })).toEqual({ ok: false, error: 'Not a SmartBrief backup file' })
  })

  it('rejects missing, invalid and newer versions', () => {
    expect(validateBackup({ ...valid(), version: undefined })).toMatchObject({ ok: false })
    expect(validateBackup({ ...valid(), version: 0 })).toMatchObject({ ok: false })
    expect(validateBackup({ ...valid(), version: 1.5 })).toMatchObject({ ok: false })
    const newer = validateBackup({ ...valid(), version: BACKUP_VERSION + 1 })
    expect(newer.ok).toBe(false)
    if (!newer.ok) expect(newer.error).toContain('newer SmartBrief')
  })

  it('rejects malformed sections and rows with a pointer to the row', () => {
    const base = valid()
    const data = base.data as Record<string, unknown>
    expect(validateBackup({ ...base, data: { ...data, savedArticles: 'x' } })).toMatchObject({ ok: false })
    const badRow = validateBackup({ ...base, data: { ...data, savedArticles: [{ id: 'a1' }] } })
    expect(badRow).toEqual({ ok: false, error: '"savedArticles[0]" needs "id" and "url"' })
    expect(
      validateBackup({ ...base, data: { ...data, sourceWeights: [{ source: 'BBC', weight: 'high' }] } })
    ).toMatchObject({ ok: false })
    expect(validateBackup({ ...base, data: { ...data, preferences: [] } })).toMatchObject({ ok: false })
  })

  it('rejects preference ratios that do not sum to 1', () => {
    const base = valid()
    const data = base.data as Record<string, unknown>
    const prefs = { positiveRatio: 0.5, neutralRatio: 0.5, negativeRatio: 0.5 }
    expect(validateBackup({ ...base, data: { ...data, preferences: prefs } })).toEqual({
      ok: false,
      error: 'Preference ratios must sum to 1',
    })
  })

  it('rejects duplicate article or story ids', () => {
    const base = valid()
    const data = base.data as Record<string, unknown>
    const dupArticles = { ...data, referencedArticles: [article('a1', 'https://x/other')] }
    expect(validateBackup({ ...base, data: dupArticles })).toMatchObject({ ok: false })
    const dupStories = { ...data, savedTopStories: [story('s1', []), story('s1', [])] }
    expect(validateBackup({ ...base, data: dupStories })).toMatchObject({ ok: false })
  })

  it('accepts null preferences and empty sections', () => {
    const result = validateBackup({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: NOW.toISOString(),
      data: {
        preferences: null,
        sourceWeights: [],
        topicWeights: [],
        savedArticles: [],
        savedTopStories: [],
        referencedArticles: [],
      },
    })
    expect(result.ok).toBe(true)
  })
})

describe('coerceRow', () => {
  const spec: FieldSpec = {
    id: 'String',
    title: 'String',
    publishedAt: 'DateTime',
    readAt: 'DateTime',
    count: 'Int',
    score: 'Float',
    isSaved: 'Boolean',
  }

  it('drops unknown fields so a newer-schema backup still imports', () => {
    expect(coerceRow({ id: 'a', futureColumn: 'x' }, spec)).toEqual({ id: 'a' })
  })

  it('revives DateTime strings and keeps nulls', () => {
    const row = coerceRow({ publishedAt: '2026-11-10T10:00:00.000Z', readAt: null }, spec)
    expect(row.publishedAt).toEqual(new Date('2026-11-10T10:00:00.000Z'))
    expect(row.readAt).toBeNull()
  })

  it('drops values of the wrong type so Prisma falls back to defaults', () => {
    expect(
      coerceRow({ publishedAt: 'not a date', count: 1.5, score: 'x', isSaved: 'yes', title: 42 }, spec)
    ).toEqual({})
  })

  it('honours the omit list', () => {
    expect(coerceRow({ id: 'a', title: 't' }, spec, ['id'])).toEqual({ title: 't' })
  })

  it('lets a column added later flow through once it is in the schema', () => {
    const later: FieldSpec = { ...spec, savedAt: 'DateTime' }
    const row = coerceRow({ id: 'a', savedAt: '2026-11-16T12:00:00.000Z' }, later)
    expect(row.savedAt).toEqual(new Date('2026-11-16T12:00:00.000Z'))
  })
})

describe('findSchemaViolation', () => {
  const rules = { required: ['title', 'publishedAt'], nonNullable: ['id', 'title', 'publishedAt', 'isSaved'] }

  it('passes complete rows', () => {
    expect(findSchemaViolation([{ title: 't', publishedAt: NOW, isSaved: false }], rules, 'savedArticles')).toBeNull()
  })

  it('reports missing required fields and nulls in non-nullable ones', () => {
    expect(findSchemaViolation([{ title: 't' }], rules, 'savedArticles')).toBe(
      '"savedArticles[0]" is missing a valid "publishedAt"'
    )
    expect(findSchemaViolation([{ title: 't', publishedAt: NOW, isSaved: null }], rules, 'x')).toBe(
      '"x[0]" has null "isSaved"'
    )
  })
})

describe('planKeyedUpserts', () => {
  it('creates new keys, updates existing ones, drops the cuid', () => {
    const rows = [
      { id: 'c1', source: 'BBC', weight: 1.2, createdAt: NOW },
      { id: 'c2', source: 'NYT', weight: 0.7, createdAt: NOW },
    ]
    const plan = planKeyedUpserts(rows, 'source', [{ id: 'L1', source: 'BBC', weight: 0.5 }])
    expect(plan.creates).toEqual([{ source: 'NYT', weight: 0.7, createdAt: NOW }])
    expect(plan.updates).toEqual([{ key: 'BBC', data: { weight: 1.2 } }])
  })

  it('counts rows with identical values as unchanged', () => {
    const lastAdjusted = new Date('2026-11-01T00:00:00.000Z')
    const plan = planKeyedUpserts(
      [{ id: 'c1', source: 'BBC', weight: 1.2, lastAdjusted, updatedAt: NOW }],
      'source',
      [{ id: 'L1', source: 'BBC', weight: 1.2, lastAdjusted: new Date(lastAdjusted), updatedAt: new Date(0) }]
    )
    expect(plan).toMatchObject({ creates: [], updates: [], unchanged: 1 })
  })

  it('ignores duplicate keys in the file', () => {
    const plan = planKeyedUpserts(
      [
        { source: 'BBC', weight: 1 },
        { source: 'BBC', weight: 2 },
      ],
      'source',
      []
    )
    expect(plan.unchanged).toBe(0)
    expect(plan.creates).toHaveLength(1)
  })
})

describe('planArticleMerge', () => {
  const ids = () => {
    let n = 0
    return () => `new-${++n}`
  }

  it('creates missing articles with their backup id', () => {
    const plan = planArticleMerge([article('a1', 'u1')], [article('a2', 'u2')], [], ids())
    expect(plan.creates.map((r) => r.id)).toEqual(['a1', 'a2'])
    expect(plan.creates[0].isSaved).toBe(true)
    expect(plan.idMap).toEqual(new Map([['a1', 'a1'], ['a2', 'a2']]))
  })

  it('matches by URL and maps backup ids to local ids', () => {
    const plan = planArticleMerge(
      [article('a1', 'u1')],
      [article('a2', 'u2')],
      [
        { id: 'L1', url: 'u1', isSaved: false },
        { id: 'L2', url: 'u2', isSaved: false },
      ],
      ids()
    )
    expect(plan.creates).toEqual([])
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toEqual({ id: 'L1', data: { isSaved: true } })
    expect(plan.unchanged).toBe(1) // referenced, not saved: left alone
    expect(plan.idMap.get('a1')).toBe('L1')
    expect(plan.idMap.get('a2')).toBe('L2')
  })

  it('promotes with saved* columns only, not read state or push bookkeeping', () => {
    const saved = article('a1', 'u1', {
      savedAt: '2026-11-16T12:00:00.000Z',
      isRead: true,
      criticalPushedAt: null,
      severity: 'critical',
    })
    const plan = planArticleMerge([saved], [], [{ id: 'L1', url: 'u1', isSaved: false }], ids())
    expect(plan.updates[0].data).toEqual({ isSaved: true, savedAt: '2026-11-16T12:00:00.000Z' })
  })

  it('is idempotent: already saved locally means unchanged', () => {
    const plan = planArticleMerge([article('a1', 'u1')], [], [{ id: 'a1', url: 'u1', isSaved: true }], ids())
    expect(plan).toMatchObject({ creates: [], updates: [], unchanged: 1 })
  })

  it('gets a fresh id when the backup id belongs to another URL', () => {
    const plan = planArticleMerge([article('a1', 'u1')], [], [{ id: 'a1', url: 'other', isSaved: false }], ids())
    expect(plan.creates[0].id).toBe('new-1')
    expect(plan.idMap.get('a1')).toBe('new-1')
  })

  it('handles the same URL listed as saved and referenced once', () => {
    const plan = planArticleMerge([article('a1', 'u1')], [article('a9', 'u1')], [], ids())
    expect(plan.creates).toHaveLength(1)
    expect(plan.idMap.get('a9')).toBe('a1')
  })
})

describe('planTopStoryMerge', () => {
  const newest = new Date('2026-11-17T06:00:00.000Z')

  it('remaps articleIds and creates as saved', () => {
    const plan = planTopStoryMerge(
      [story('s1', ['a1', 'a2', 'missing'], { saved: false })],
      [],
      new Map([['a1', 'L1'], ['a2', 'a2']]),
      null
    )
    expect(plan.creates).toHaveLength(1)
    expect(JSON.parse(plan.creates[0].articleIds as string)).toEqual(['L1', 'a2', 'missing'])
    expect(plan.creates[0].saved).toBe(true)
  })

  it('keeps an older createdAt and clamps a newer one below the local batch', () => {
    const older = new Date('2026-11-01T00:00:00.000Z')
    const newer = new Date('2026-11-17T07:00:00.000Z')
    const plan = planTopStoryMerge(
      [story('old', [], { createdAt: older }), story('new', [], { createdAt: newer }), story('none', [])],
      [],
      new Map(),
      newest
    )
    const byId = Object.fromEntries(plan.creates.map((r) => [r.id, r.createdAt]))
    expect(byId.old).toEqual(older)
    expect(byId.new).toEqual(new Date(newest.getTime() - 1))
    expect(byId.none).toEqual(new Date(newest.getTime() - 1))
  })

  it('promotes an existing unsaved story and skips a saved one', () => {
    const plan = planTopStoryMerge(
      [story('s1', ['a1'], { createdAt: newest }), story('s2', [])],
      [
        { id: 's1', saved: false },
        { id: 's2', saved: true },
      ],
      new Map([['a1', 'L1']]),
      newest
    )
    expect(plan.creates).toEqual([])
    expect(plan.unchanged).toBe(1)
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({ id: 's1', data: { saved: true, articleIds: '["L1"]' } })
    expect(plan.updates[0].data).not.toHaveProperty('createdAt')
  })

  it('is idempotent on a second import', () => {
    const stories = [story('s1', ['a1'])]
    const plan = planTopStoryMerge(stories, [{ id: 's1', saved: true }], new Map(), newest)
    expect(plan).toMatchObject({ creates: [], updates: [], unchanged: 1 })
  })
})
