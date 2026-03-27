import { db } from './db'
import { fetchAllFeeds } from './news-fetcher'
import { analyzeSentiment, generateTopStories } from './claude-analyzer'
import type { Article } from '@/types'

export async function refreshNews(): Promise<{
  articleCount: number
  lastRefreshed: Date
}> {
  // 0. Get user preferences to check enabled sources
  const userPrefs = await db.userPreferences.findUnique({ where: { id: 'default' } })
  const enabledSourceIds = userPrefs?.enabledSources
    ? userPrefs.enabledSources.split(',').filter(Boolean)
    : []

  // 1. Fetch all RSS feeds in parallel
  console.log('Fetching RSS feeds...')
  const rawArticles = await fetchAllFeeds(enabledSourceIds)
  console.log(`Fetched ${rawArticles.length} raw articles`)

  // 2. Deduplicate by URL (upsert to DB)
  let newArticleCount = 0
  for (const raw of rawArticles) {
    try {
      const existing = await db.article.findUnique({ where: { url: raw.url } })
      if (!existing) {
        await db.article.create({
          data: {
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
          },
        })
        newArticleCount++
      }
    } catch (err) {
      console.error(`Error upserting article ${raw.url}:`, err)
    }
  }

  console.log(`Added ${newArticleCount} new articles to DB`)

  // 3. Find articles without sentiment analysis (neutral with score=0 is our "unanalyzed" marker)
  const unanalyzed = await db.article.findMany({
    where: {
      AND: [
        { sentiment: 'neutral' },
        { sentimentScore: 0 },
      ],
    },
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

    // 5. Update articles in DB with sentiment
    for (const result of sentimentResults) {
      try {
        await db.article.update({
          where: { id: result.id },
          data: {
            sentiment: result.sentiment,
            sentimentScore: result.score,
          },
        })
      } catch (err) {
        console.error(`Error updating sentiment for article ${result.id}:`, err)
      }
    }

    console.log(`Updated sentiment for ${sentimentResults.length} articles`)
  }

  // 6. Generate top stories from recent articles
  const recentArticles = await db.article.findMany({
    orderBy: { publishedAt: 'desc' },
    take: 100,
  })

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

  // 7. Delete old top stories and store new ones
  if (topStoryData.length > 0) {
    await db.topStory.deleteMany({})

    for (const ts of topStoryData) {
      try {
        await db.topStory.create({
          data: {
            title: ts.title,
            summary: ts.summary,
            category: ts.category,
            articleIds: JSON.stringify(ts.articleIds),
            sources: JSON.stringify(ts.sources),
            sentiment: ts.sentiment,
          },
        })
      } catch (err) {
        console.error('Error creating top story:', err)
      }
    }

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
}
