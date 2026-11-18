import { db } from './db'
import { fetchAllFeeds } from './news-fetcher'
import { enrichWithFullText } from './article-enricher'
import { analyzeSentiment, generateTopStories } from './claude-analyzer'
import { runSignalCleanupIfNeeded } from './topic-weights'
import { matchRebuiltClusters, parseArticleIds } from './top-stories'
import {
  PRUNE_CHUNK_SIZE,
  chunk,
  collectProtectedArticleIds,
  feedbackCutoff,
  parseRetentionDays,
  retentionCutoff,
  selectArticlesToPrune,
  selectOrphanedFeedbackArticleIds,
  shouldIngest,
} from './retention'
import type { Article } from '@/types'

type RefreshResult = { articleCount: number; lastRefreshed: Date }

// Single-flight: scheduled and manual refresh share one in-flight run. Kept on
// globalThis because dev hot reload can load this module twice.
const refreshGlobal = globalThis as typeof globalThis & {
  __smartbriefRefreshInFlight?: Promise<RefreshResult> | null
}

export function refreshNews(): Promise<RefreshResult> {
  const existing = refreshGlobal.__smartbriefRefreshInFlight
  if (existing) return existing
  const run = runRefresh().finally(() => {
    refreshGlobal.__smartbriefRefreshInFlight = null
  })
  refreshGlobal.__smartbriefRefreshInFlight = run
  return run
}

async function runRefresh(): Promise<RefreshResult> {
  const t0 = Date.now()
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`

  // Retention window (#31). One start time for the ingest guard and the prune.
  const refreshStart = new Date(t0)
  const retentionDays = getRetentionDays()
  const ingestCutoff = retentionDays > 0 ? retentionCutoff(refreshStart, retentionDays) : null

  // 0. Get user preferences to check enabled sources
  const userPrefs = await db.userPreferences.findUnique({ where: { id: 'default' } })
  const enabledSourceIds = userPrefs?.enabledSources
    ? userPrefs.enabledSources.split(',').filter(Boolean)
    : []

  const customSources = await db.customSource.findMany()

  // 1. Fetch all RSS feeds in parallel
  console.log('Fetching RSS feeds...')
  const rawArticles = await fetchAllFeeds(enabledSourceIds, customSources)
  console.log(`Fetched ${rawArticles.length} raw articles [${elapsed()}]`)

  // 2. Deduplicate by URL — query existing URLs in this batch, then insert only new ones
  const incomingUrls = rawArticles.map((r) => r.url)
  const existingUrls = new Set(
    (await db.article.findMany({ where: { url: { in: incomingUrls } }, select: { url: true } }))
      .map((a) => a.url)
  )
  // Also dedup within the batch: the same URL can appear in several feeds,
  // which would fail createMany on the unique url constraint.
  // Items published before the retention cutoff are skipped: they would be
  // pruned on the next refresh, and a feed that still serves a pruned URL
  // must not re-add it as a "new" article (dedup only sees existing rows).
  const seenUrls = new Set<string>()
  let staleSkipped = 0
  const newRawArticles = rawArticles
    .filter((r) => {
      if (existingUrls.has(r.url) || seenUrls.has(r.url)) return false
      seenUrls.add(r.url)
      if (!shouldIngest(r.publishedAt, ingestCutoff)) {
        staleSkipped++
        return false
      }
      return true
    })

  // 2b. Full text for sources that offer it (Handelsblatt: free part of H+).
  // Only new articles, so each page is fetched once.
  try {
    await enrichWithFullText(newRawArticles)
  } catch (e) {
    console.error('[enrich] failed:', e)
  }

  const newArticleData = newRawArticles.map((raw) => ({
    title: raw.title,
    description: raw.description,
    content: raw.content,
    url: raw.url,
    imageUrl: raw.imageUrl,
    publishedAt: raw.publishedAt,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    category: raw.category,
    isPremium: raw.isPremium ?? false,
    sentiment: 'neutral',
    sentimentScore: 0,
  }))
  if (newArticleData.length > 0) {
    await db.article.createMany({ data: newArticleData })
  }
  const newArticleCount = newArticleData.length

  console.log(
    `Added ${newArticleCount} new articles to DB` +
      (staleSkipped > 0 ? ` (skipped ${staleSkipped} older than ${retentionDays} days)` : '')
  )

  // 3a. One-time backfill: before the empty-severity marker, failed or key-less
  //     analyses were stored as neutral / score 0 / 'routine'. Reset those to
  //     unanalyzed once so they get a real analysis. Runs only once because a
  //     genuine neutral result can look identical.
  await backfillLegacySeverity()

  // 3. Find articles without sentiment analysis. Every successful analysis sets
  //    a severity, so the empty default marks "not analyzed yet". (Using
  //    neutral + score 0 re-analyzed genuinely neutral articles on every refresh.)
  const unanalyzed = await db.article.findMany({
    where: { severity: '' },
    take: 200,
    orderBy: { fetchedAt: 'desc' },
  })

  console.log(`Found ${unanalyzed.length} articles needing sentiment analysis`)

  // 4. Batch analyze sentiment in batches of 20
  if (unanalyzed.length > 0) {
    const sentimentResults = await analyzeSentiment(
      unanalyzed.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
      }))
    )

    // 5. Update articles in DB with sentiment — single transaction
    await db.$transaction(
      sentimentResults.map((result) =>
        db.article.update({
          where: { id: result.id },
          data: {
            sentiment: result.sentiment,
            sentimentScore: result.score,
            severity: result.severity ?? 'routine',
          },
        })
      )
    )

    console.log(`Updated sentiment for ${sentimentResults.length} articles [${elapsed()}]`)
  }

  // 6. Generate top stories — skip entirely if no new articles arrived
  if (newArticleCount === 0) {
    console.log('No new articles — skipping top stories generation')
    // The existing unsaved clusters stay the current batch, so they protect
    // their articles just like the saved ones.
    await pruneOldArticles(refreshStart, retentionDays)
    const now = new Date()
    await db.appState.upsert({
      where: { id: 'default' },
      create: { id: 'default', lastRefreshed: now },
      update: { lastRefreshed: now },
    })
    await db.userPreferences.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        positiveRatio: 0.4,
        neutralRatio: 0.4,
        negativeRatio: 0.2,
        enabledCategories: 'technology,science,business,world,positive',
        refreshIntervalMins: 360,
      },
      update: {},
    })
    return { articleCount: await db.article.count(), lastRefreshed: now }
  }

  // Generate top stories from recent articles (last 12h; fallback to latest 100 if sparse)
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000)
  let recentArticles = await db.article.findMany({
    where: { publishedAt: { gte: twelveHoursAgo } },
    orderBy: { publishedAt: 'desc' },
    take: 200,
  })
  if (recentArticles.length < 5) {
    recentArticles = await db.article.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 100,
    })
  }

  // Map DB articles to Article type
  const articles: Article[] = recentArticles.map((a) => ({
    ...a,
    sentiment: a.sentiment as 'positive' | 'neutral' | 'negative',
    description: a.description,
    content: a.content,
    imageUrl: a.imageUrl,
    sourceUrl: a.sourceUrl,
    aiSummary: a.aiSummary,
  }))

  console.log('Generating top stories...')
  const topStoryData = await generateTopStories(articles)
  console.log(`Generated ${topStoryData.length} top stories [${elapsed()}]`)

  // 7. Replace unsaved top stories with the new batch. Saved ones survive and
  // the shared createdAt marks the current batch for the feed. A new cluster
  // that continues a saved one (strong articleIds overlap) updates that saved
  // row instead of creating a duplicate next to it (#29). The saved row keeps
  // its id, saved flag and savedAt, and joins the current batch.
  // Interactive transaction: the saved-row read and the writes see the same
  // state, so an unsave during refresh cannot drop or orphan a cluster.
  if (topStoryData.length > 0) {
    const batchCreatedAt = new Date()
    const toRowData = (ts: (typeof topStoryData)[number]) => ({
      createdAt: batchCreatedAt,
      title: ts.title,
      summary: ts.summary,
      category: ts.category,
      articleIds: JSON.stringify(ts.articleIds),
      sources: JSON.stringify(ts.sources),
      sentiment: ts.sentiment,
      bullets: JSON.stringify(ts.bullets ?? []),
      clusterArticles: JSON.stringify(ts.clusterArticles ?? []),
    })
    const { created, merged } = await db.$transaction(async (tx) => {
      const savedRows = await tx.topStory.findMany({
        where: { saved: true },
        select: { id: true, articleIds: true, savedAt: true, createdAt: true },
      })
      const matches = matchRebuiltClusters(
        topStoryData,
        savedRows.map((row) => ({ id: row.id, articleIds: parseArticleIds(row.articleIds) }))
      )
      const savedById = new Map(savedRows.map((row) => [row.id, row]))

      await tx.topStory.deleteMany({ where: { saved: false } })
      for (const [idx, savedId] of matches) {
        const target = savedById.get(savedId)
        await tx.topStory.update({
          where: { id: savedId },
          data: {
            ...toRowData(topStoryData[idx]),
            // Keep the saved cluster's original articles: retention protects
            // only ids listed here, so dropping them would lose them for good.
            articleIds: JSON.stringify([
              ...new Set([
                ...topStoryData[idx].articleIds,
                ...parseArticleIds(target?.articleIds ?? '[]'),
              ]),
            ]),
            // Rows saved before savedAt existed: pin their /saved position to
            // the original createdAt before the merge moves createdAt forward.
            ...(target && target.savedAt === null ? { savedAt: target.createdAt } : {}),
          },
        })
      }
      const unmatched = topStoryData.filter((_, idx) => !matches.has(idx))
      await tx.topStory.createMany({ data: unmatched.map(toRowData) })
      return { created: unmatched.length, merged: matches.size }
    })
    console.log(`Created ${created} top stories, merged ${merged} into saved clusters`)
  }

  // 7b. Retention (#31). Runs after step 7, so the remaining clusters are
  // exactly the saved ones plus the current batch.
  await pruneOldArticles(refreshStart, retentionDays)

  // 8. Update AppState.lastRefreshed
  const now = new Date()
  await db.appState.upsert({
    where: { id: 'default' },
    create: { id: 'default', lastRefreshed: now },
    update: { lastRefreshed: now },
  })

  // Ensure UserPreferences exist
  await db.userPreferences.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      positiveRatio: 0.4,
      neutralRatio: 0.4,
      negativeRatio: 0.2,
      enabledCategories: 'technology,science,business,world,positive',
      refreshIntervalMins: 360,
    },
    update: {},
  })

  const totalCount = await db.article.count()
  return { articleCount: totalCount, lastRefreshed: now }
}

export async function ensureDefaultPreferences(): Promise<void> {
  await db.userPreferences.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      positiveRatio: 0.4,
      neutralRatio: 0.4,
      negativeRatio: 0.2,
      enabledCategories: 'technology,science,business,world,positive',
      refreshIntervalMins: 360,
    },
    update: {},
  })

  // Throttled 90-day signal log cleanup — runs at most once per process-day
  void runSignalCleanupIfNeeded().catch((e) =>
    console.error('[ensureDefaultPreferences] signal cleanup failed:', e)
  )
}

let warnedInvalidRetention = false

/** Reads SMARTBRIEF_RETENTION_DAYS at call time; 0 means retention is off. */
function getRetentionDays(): number {
  const raw = process.env.SMARTBRIEF_RETENTION_DAYS
  const { days, valid } = parseRetentionDays(raw)
  if (!valid && !warnedInvalidRetention) {
    warnedInvalidRetention = true
    console.warn(`[retention] invalid SMARTBRIEF_RETENTION_DAYS="${raw}", using ${days} days`)
  }
  return days
}

/**
 * Deletes articles outside the retention window (#31). Never deletes saved
 * articles, articles referenced by any remaining TopStory (saved clusters and
 * the current batch), or articles fetched or read inside the window.
 * Also removes ArticleFeedback whose article is gone and that is older than
 * feedbackCutoff(). FeedbackSignal and the learned weights are not touched.
 * Housekeeping only: errors are logged and never fail the refresh.
 */
export async function pruneOldArticles(
  now: Date,
  days: number
): Promise<{ articles: number; feedback: number }> {
  const result = { articles: 0, feedback: 0 }
  if (days <= 0) return result
  try {
    const cutoff = retentionCutoff(now, days)
    // SQL pre-filter, repeated on delete: a save or read that lands after the
    // selection wins. selectArticlesToPrune applies the full rule.
    const prunableWhere = {
      isSaved: false,
      publishedAt: { lt: cutoff },
      fetchedAt: { lt: cutoff },
      OR: [{ readAt: null }, { readAt: { lt: cutoff } }],
    }
    const [stories, candidates] = await Promise.all([
      db.topStory.findMany({ select: { articleIds: true } }),
      db.article.findMany({
        where: prunableWhere,
        select: { id: true, isSaved: true, publishedAt: true, fetchedAt: true, readAt: true },
      }),
    ])
    const { ids: protectedIds, unparseable } = collectProtectedArticleIds(stories)
    if (unparseable > 0) {
      // Fail closed: a cluster whose ids cannot be read protects nothing.
      console.warn(`[retention] skipped: ${unparseable} top stories with unreadable articleIds`)
      return result
    }
    const pruneIds = selectArticlesToPrune(candidates, protectedIds, cutoff)
    for (const ids of chunk(pruneIds, PRUNE_CHUNK_SIZE)) {
      const { count } = await db.article.deleteMany({ where: { id: { in: ids }, ...prunableWhere } })
      result.articles += count
    }

    // ArticleFeedback has no FK, so no cascade. Sweep rows whose article is
    // gone once they are older than the feedback window.
    const fbCutoff = feedbackCutoff(now, days)
    const feedbackArticleIds = (
      await db.articleFeedback.findMany({
        where: { createdAt: { lt: fbCutoff } },
        select: { articleId: true },
        distinct: ['articleId'],
      })
    ).map((f) => f.articleId)
    const existingIds = new Set<string>()
    for (const ids of chunk(feedbackArticleIds, PRUNE_CHUNK_SIZE)) {
      const rows = await db.article.findMany({ where: { id: { in: ids } }, select: { id: true } })
      for (const row of rows) existingIds.add(row.id)
    }
    const orphanIds = selectOrphanedFeedbackArticleIds(feedbackArticleIds, existingIds)
    for (const ids of chunk(orphanIds, PRUNE_CHUNK_SIZE)) {
      const { count } = await db.articleFeedback.deleteMany({
        where: { articleId: { in: ids }, createdAt: { lt: fbCutoff } },
      })
      result.feedback += count
    }

    if (result.articles > 0 || result.feedback > 0) {
      console.log(
        `[retention] pruned ${result.articles} articles older than ${days} days, ` +
          `${result.feedback} orphaned feedback rows`
      )
    }
  } catch (e) {
    console.error('[retention] prune failed:', e)
  }
  return result
}

async function backfillLegacySeverity(): Promise<void> {
  const state = await db.appState.findUnique({ where: { id: 'default' } })
  if (state?.severityBackfillDone) return
  const { count } = await db.article.updateMany({
    where: { sentiment: 'neutral', sentimentScore: 0, severity: 'routine' },
    data: { severity: '' },
  })
  await db.appState.upsert({
    where: { id: 'default' },
    create: { id: 'default', severityBackfillDone: true },
    update: { severityBackfillDone: true },
  })
  if (count > 0) console.log(`Backfill: reset ${count} legacy fallback articles to unanalyzed`)
}
