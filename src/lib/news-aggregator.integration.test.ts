/**
 * DB-backed integration test for refreshNews() (#37) and article retention (#31).
 *
 * Isolation: DATABASE_URL points to a fresh SQLite file in the OS temp dir
 * BEFORE Prisma is imported (news-aggregator and db are imported dynamically
 * in beforeAll). RSS fetching and both Claude calls are mocked. The file is
 * deleted afterwards. The real DB is never opened.
 */
import { execFileSync } from 'node:child_process'
import { realpathSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PrismaClient } from '@prisma/client'

const DB_PATH = path.join(os.tmpdir(), `smartbrief-refresh-it-${process.pid}-${Date.now()}.db`)
process.env.DATABASE_URL = `file:${DB_PATH}`
delete process.env.SMARTBRIEF_RETENTION_DAYS

vi.mock('./news-fetcher', () => ({ fetchAllFeeds: vi.fn() }))
vi.mock('./claude-analyzer', () => ({
  analyzeSentiment: vi.fn(),
  generateTopStories: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)

type RefreshNews = typeof import('./news-aggregator').refreshNews
type Cluster = {
  title: string
  summary: string
  category: string
  articleIds: string[]
  sources: string[]
  sentiment: 'neutral'
  bullets: string[]
  clusterArticles: { title: string; source: string; url: string }[]
}
type MockArticle = { id: string; url: string }

let db: PrismaClient
let refreshNews: RefreshNews
let fetchAllFeeds: ReturnType<typeof vi.fn>
let analyzeSentiment: ReturnType<typeof vi.fn>
let generateTopStories: ReturnType<typeof vi.fn>

beforeAll(async () => {
  // Hard guard: never run against anything but the throwaway file.
  if (process.env.DATABASE_URL !== `file:${DB_PATH}` || !DB_PATH.startsWith(os.tmpdir())) {
    throw new Error(`Refusing to run: DATABASE_URL is ${process.env.DATABASE_URL}`)
  }
  execFileSync(
    path.join(process.cwd(), 'node_modules', '.bin', 'prisma'),
    ['db', 'push', '--skip-generate'],
    { env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` }, stdio: 'pipe' }
  )
  // db.ts caches the client on globalThis; never reuse one opened elsewhere.
  delete (globalThis as { prisma?: unknown }).prisma
  ;({ db } = await import('./db'))
  // Second guard on the real connection, before any write.
  const dbs = await db.$queryRawUnsafe<{ name: string; file: string }[]>('PRAGMA database_list')
  const mainFile = dbs.find((d) => d.name === 'main')?.file ?? ''
  if (!mainFile || realpathSync(mainFile) !== realpathSync(DB_PATH)) {
    throw new Error(`Refusing to run: connected to ${mainFile}`)
  }
  ;({ refreshNews } = await import('./news-aggregator'))
  const fetcher = await import('./news-fetcher')
  const analyzer = await import('./claude-analyzer')
  fetchAllFeeds = vi.mocked(fetcher.fetchAllFeeds) as unknown as ReturnType<typeof vi.fn>
  analyzeSentiment = vi.mocked(analyzer.analyzeSentiment) as unknown as ReturnType<typeof vi.fn>
  generateTopStories = vi.mocked(analyzer.generateTopStories) as unknown as ReturnType<
    typeof vi.fn
  >
  // refreshNews logs every step; keep the test output readable.
  vi.spyOn(console, 'log').mockImplementation(() => {})
}, 120_000)

afterAll(async () => {
  await db?.$disconnect()
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(`${DB_PATH}${suffix}`, { force: true })
  }
})

beforeEach(async () => {
  await db.article.deleteMany()
  await db.topStory.deleteMany()
  await db.articleFeedback.deleteMany()
  await db.feedbackSignal.deleteMany()
  await db.sourceWeight.deleteMany()
  await db.topicWeight.deleteMany()
  await db.appState.deleteMany()
  await db.userPreferences.deleteMany()
  // Seeds look like legacy fallback rows; skip the one-time severity backfill.
  await db.appState.create({ data: { id: 'default', severityBackfillDone: true } })
  vi.clearAllMocks()
  fetchAllFeeds.mockResolvedValue([])
  analyzeSentiment.mockImplementation(async (items: { id: string }[]) =>
    items.map((a) => ({ id: a.id, sentiment: 'neutral', score: 0.1, severity: 'routine' }))
  )
  generateTopStories.mockResolvedValue([])
})

afterEach(() => {
  delete process.env.SMARTBRIEF_RETENTION_DAYS
})

// ── helpers ────────────────────────────────────────────────────────────────

async function seedArticle(
  key: string,
  opts: { published?: number; fetched?: number; read?: number; saved?: boolean } = {}
): Promise<string> {
  const published = opts.published ?? 60
  const row = await db.article.create({
    data: {
      title: `Seed ${key}`,
      description: `About ${key}`,
      url: `https://seed.example/${key}`,
      publishedAt: daysAgo(published),
      fetchedAt: daysAgo(opts.fetched ?? published),
      source: 'BBC',
      category: 'world',
      severity: 'routine',
      ...(opts.read !== undefined ? { isRead: true, readAt: daysAgo(opts.read) } : {}),
      ...(opts.saved ? { isSaved: true, savedAt: daysAgo(1) } : {}),
    },
  })
  return row.id
}

function rawArticle(key: string, publishedDaysAgo = 0.05) {
  return {
    title: `Feed ${key}`,
    description: `About ${key}`,
    content: null,
    url: `https://feed.example/${key}`,
    imageUrl: null,
    publishedAt: daysAgo(publishedDaysAgo),
    source: 'Reuters',
    sourceUrl: null,
    category: 'world',
  }
}

function cluster(title: string, articleIds: string[]): Cluster {
  return {
    title,
    summary: `${title} summary`,
    category: 'world',
    articleIds,
    sources: ['BBC', 'Reuters'],
    sentiment: 'neutral',
    bullets: [`${title} bullet`],
    clusterArticles: [],
  }
}

function idsByFeedKey(articles: MockArticle[], ...keys: string[]): string[] {
  return keys.map((k) => {
    const hit = articles.find((a) => a.url === `https://feed.example/${k}`)
    if (!hit) throw new Error(`feed article ${k} not passed to generateTopStories`)
    return hit.id
  })
}

async function seedStory(data: {
  title: string
  articleIds: string[]
  saved?: boolean
  savedAt?: Date | null
  createdAt: Date
}) {
  return db.topStory.create({
    data: {
      title: data.title,
      summary: `${data.title} summary`,
      category: 'world',
      articleIds: JSON.stringify(data.articleIds),
      sources: '["BBC"]',
      sentiment: 'neutral',
      saved: data.saved ?? false,
      savedAt: data.savedAt ?? null,
      createdAt: data.createdAt,
    },
  })
}

const articleExists = async (id: string) => (await db.article.count({ where: { id } })) === 1

// ── tests ──────────────────────────────────────────────────────────────────

describe('refreshNews() step 7: cluster replace and merge', () => {
  it('keeps saved clusters, merges a rebuilt cluster into its saved row, replaces unsaved ones', async () => {
    const r = await Promise.all(
      ['r1', 'r2', 'r3', 'r4'].map((k) => seedArticle(k, { published: 0.05 }))
    )
    const savedAt = daysAgo(2)
    const saved = await seedStory({
      title: 'Saved original',
      articleIds: [r[0], r[1], r[2]],
      saved: true,
      savedAt,
      createdAt: daysAgo(3),
    })
    const otherSaved = await seedStory({
      title: 'Other saved',
      articleIds: ['gone-1', 'gone-2'],
      saved: true,
      savedAt: daysAgo(1),
      createdAt: daysAgo(5),
    })
    const unsaved = await seedStory({ title: 'Old batch', articleIds: [r[3]], createdAt: daysAgo(1) })

    fetchAllFeeds.mockResolvedValue([rawArticle('n1'), rawArticle('n2')])
    generateTopStories.mockImplementation(async (articles: MockArticle[]) => [
      cluster('Rebuilt', [r[1], r[2], r[3]]),
      cluster('Fresh', idsByFeedKey(articles, 'n1', 'n2')),
    ])

    await refreshNews()

    const rows = await db.topStory.findMany()
    expect(rows).toHaveLength(3)
    expect(rows.find((s) => s.id === unsaved.id)).toBeUndefined()

    const merged = rows.find((s) => s.id === saved.id)!
    expect(merged.saved).toBe(true)
    expect(merged.savedAt?.getTime()).toBe(savedAt.getTime())
    expect(merged.title).toBe('Rebuilt')
    // Original r0 stays listed, so retention keeps protecting it.
    expect(JSON.parse(merged.articleIds)).toEqual([r[1], r[2], r[3], r[0]])
    expect(merged.createdAt.getTime()).toBeGreaterThan(saved.createdAt.getTime())

    const untouched = rows.find((s) => s.id === otherSaved.id)!
    expect(untouched.title).toBe('Other saved')
    expect(untouched.createdAt.getTime()).toBe(otherSaved.createdAt.getTime())

    const fresh = rows.find((s) => s.title === 'Fresh')!
    expect(fresh.saved).toBe(false)
    expect(fresh.createdAt.getTime()).toBe(merged.createdAt.getTime())
  })
})

describe('refreshNews() retention', () => {
  it('prunes old unprotected articles and keeps protected ones', async () => {
    const oldPlain = await seedArticle('old-plain')
    const oldSaved = await seedArticle('old-saved', { saved: true })
    const oldInSaved = await seedArticle('old-in-saved-cluster')
    const oldInCurrent = await seedArticle('old-in-current-batch')
    const oldInReplaced = await seedArticle('old-in-replaced-batch')
    const oldReadRecently = await seedArticle('old-read-recently', { read: 1 })
    const oldReadLongAgo = await seedArticle('old-read-long-ago', { read: 45 })
    const oldFetchedRecently = await seedArticle('old-fetched-recently', { fetched: 1 })
    const recent = await seedArticle('recent', { published: 1 })

    await seedStory({
      title: 'Saved cluster',
      articleIds: [oldInSaved, 'missing'],
      saved: true,
      savedAt: daysAgo(50),
      createdAt: daysAgo(50),
    })
    await seedStory({ title: 'Previous batch', articleIds: [oldInReplaced], createdAt: daysAgo(1) })

    const orphanOld = await db.articleFeedback.create({
      data: { articleId: oldPlain, feedback: 'less-like-this', createdAt: daysAgo(40) },
    })
    const orphanYoung = await db.articleFeedback.create({
      data: { articleId: oldPlain, feedback: 'too-negative', createdAt: daysAgo(2) },
    })
    const keptOld = await db.articleFeedback.create({
      data: { articleId: oldSaved, feedback: 'more-like-this', createdAt: daysAgo(40) },
    })
    await db.feedbackSignal.create({
      data: { articleId: oldPlain, topic: 'world', source: 'BBC', action: 'less-like-this' },
    })
    await db.sourceWeight.create({ data: { source: 'BBC', weight: 0.7 } })
    await db.topicWeight.create({ data: { topic: 'world', weight: 1.3 } })

    fetchAllFeeds.mockResolvedValue([rawArticle('n1'), rawArticle('stale', 60)])
    generateTopStories.mockImplementation(async (articles: MockArticle[]) => [
      cluster('Current', [oldInCurrent, ...idsByFeedKey(articles, 'n1')]),
    ])

    const { articleCount } = await refreshNews()

    // Pruned: unreferenced, referenced only by the replaced batch, read before the window.
    expect(await articleExists(oldPlain)).toBe(false)
    expect(await articleExists(oldInReplaced)).toBe(false)
    expect(await articleExists(oldReadLongAgo)).toBe(false)

    // Kept: saved, in a saved cluster, in the current batch, read/fetched in the window, recent.
    for (const id of [oldSaved, oldInSaved, oldInCurrent, oldReadRecently, oldFetchedRecently, recent]) {
      expect(await articleExists(id)).toBe(true)
    }

    // Ingest guard: the stale feed item is not inserted, the fresh one is.
    expect(await db.article.count({ where: { url: 'https://feed.example/stale' } })).toBe(0)
    expect(await db.article.count({ where: { url: 'https://feed.example/n1' } })).toBe(1)
    expect(articleCount).toBe(7)

    // Feedback: old orphan removed, young orphan and feedback on live articles kept.
    const feedbackIds = (await db.articleFeedback.findMany()).map((f) => f.id).sort()
    expect(feedbackIds).toEqual([orphanYoung.id, keptOld.id].sort())
    expect(feedbackIds).not.toContain(orphanOld.id)

    // Learned state untouched.
    expect(await db.feedbackSignal.count()).toBe(1)
    expect((await db.sourceWeight.findUnique({ where: { source: 'BBC' } }))?.weight).toBe(0.7)
    expect((await db.topicWeight.findUnique({ where: { topic: 'world' } }))?.weight).toBe(1.3)
  })

  it('also prunes when no new articles arrive, keeping the current batch', async () => {
    const oldPlain = await seedArticle('old-plain')
    const oldInBatch = await seedArticle('old-in-batch')
    const batch = await seedStory({ title: 'Current batch', articleIds: [oldInBatch], createdAt: daysAgo(1) })

    fetchAllFeeds.mockResolvedValue([])

    await refreshNews()

    expect(generateTopStories).not.toHaveBeenCalled()
    expect(await articleExists(oldPlain)).toBe(false)
    expect(await articleExists(oldInBatch)).toBe(true)
    expect(await db.topStory.count({ where: { id: batch.id } })).toBe(1)
  })

  it('SMARTBRIEF_RETENTION_DAYS=0 turns pruning and the ingest guard off', async () => {
    process.env.SMARTBRIEF_RETENTION_DAYS = '0'
    const oldPlain = await seedArticle('old-plain')
    fetchAllFeeds.mockResolvedValue([rawArticle('stale', 60)])

    await refreshNews()

    expect(await articleExists(oldPlain)).toBe(true)
    expect(await db.article.count({ where: { url: 'https://feed.example/stale' } })).toBe(1)
  })

  it('prunes a large backlog across several delete chunks', async () => {
    const old = daysAgo(60)
    await db.article.createMany({
      data: Array.from({ length: 1201 }, (_, i) => ({
        title: `Bulk ${i}`,
        url: `https://seed.example/bulk-${i}`,
        publishedAt: old,
        fetchedAt: old,
        source: 'BBC',
        category: 'world',
        severity: 'routine',
      })),
    })
    const keep = await seedArticle('bulk-saved', { saved: true })

    await refreshNews()

    expect(await db.article.count()).toBe(1)
    expect(await articleExists(keep)).toBe(true)
  })

  it('fails closed when a cluster has unreadable articleIds', async () => {
    const oldPlain = await seedArticle('old-plain')
    await db.topStory.create({
      data: {
        title: 'Broken saved',
        summary: 's',
        category: 'world',
        articleIds: 'not json',
        sources: '[]',
        saved: true,
        createdAt: daysAgo(2),
      },
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await refreshNews()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[retention] skipped'))
    } finally {
      warn.mockRestore()
    }

    expect(await articleExists(oldPlain)).toBe(true)
  })

  it('a prune error is logged and does not fail the refresh', async () => {
    const oldPlain = await seedArticle('old-plain')
    // Real DB error: a trigger aborts every article delete.
    await db.$executeRawUnsafe(
      `CREATE TRIGGER it_block_article_delete BEFORE DELETE ON "Article"
       BEGIN SELECT RAISE(ABORT, 'blocked by test'); END`
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(refreshNews()).resolves.toMatchObject({ articleCount: 1 })
      expect(error).toHaveBeenCalledWith('[retention] prune failed:', expect.any(Error))
    } finally {
      // mockRestore also clears the call history, so assert before it.
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS it_block_article_delete')
      error.mockRestore()
    }

    expect(await articleExists(oldPlain)).toBe(true)
  })

  it('honours a custom window', async () => {
    process.env.SMARTBRIEF_RETENTION_DAYS = '7'
    const tenDays = await seedArticle('ten-days', { published: 10 })
    const threeDays = await seedArticle('three-days', { published: 3 })

    await refreshNews()

    expect(await articleExists(tenDays)).toBe(false)
    expect(await articleExists(threeDays)).toBe(true)
  })
})
