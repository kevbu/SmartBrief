import { db } from './db'
import { fetchAllFeeds } from './news-fetcher'
import { analyzeSentiment, generateTopStories } from './claude-analyzer'
import { runSignalCleanupIfNeeded } from './topic-weights'
import type { Article } from '@/types'

export async function refreshNews(): Promise<{
  articleCount: number
  lastRefreshed: Date
}> {
  const t0 = Date.now()
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`

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
  const seenUrls = new Set<string>()
  const newArticleData = rawArticles
    .filter((r) => {
      if (existingUrls.has(r.url) || seenUrls.has(r.url)) return false
      seenUrls.add(r.url)
      return true
    })
    .map((raw) => ({
      title: raw.title,
      description: raw.description,
      content: raw.content,
      url: raw.url,
      imageUrl: raw.imageUrl,
      publishedAt: raw.publishedAt,
      source: raw.source,
      sourceUrl: raw.sourceUrl,
      category: raw.category,
      sentiment: 'neutral',
      sentimentScore: 0,
    }))
  if (newArticleData.length > 0) {
    await db.article.createMany({ data: newArticleData })
  }
  const newArticleCount = newArticleData.length

  console.log(`Added ${newArticleCount} new articles to DB`)

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
        refreshIntervalMins: 60,
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

  // 7. Delete old top stories and store new ones in a single batch
  if (topStoryData.length > 0) {
    await db.topStory.deleteMany({})
    await db.topStory.createMany({
      data: topStoryData.map((ts) => ({
        title: ts.title,
        summary: ts.summary,
        category: ts.category,
        articleIds: JSON.stringify(ts.articleIds),
        sources: JSON.stringify(ts.sources),
        sentiment: ts.sentiment,
        bullets: JSON.stringify(ts.bullets ?? []),
        clusterArticles: JSON.stringify(ts.clusterArticles ?? []),
      })),
    })
    console.log(`Created ${topStoryData.length} top stories`)
  }

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
      refreshIntervalMins: 60,
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
      refreshIntervalMins: 60,
    },
    update: {},
  })

  // Throttled 90-day signal log cleanup — runs at most once per process-day
  void runSignalCleanupIfNeeded().catch((e) =>
    console.error('[ensureDefaultPreferences] signal cleanup failed:', e)
  )
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
