import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applyBalanceFilter, computeBalanceStats } from '@/lib/balance-filter'
import { ensureDefaultPreferences } from '@/lib/news-aggregator'
import { applyDecayAndGetWeightMap, effectiveNegativeRatio } from '@/lib/source-weights'
import type { Article, TopStory, UserPreferences, NewsApiResponse, MoodPreset, DepthMode } from '@/types'

export async function GET(request: Request) {
  try {
    await ensureDefaultPreferences()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'all'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)

    // Get preferences
    const prefsDb = await db.userPreferences.findUnique({
      where: { id: 'default' },
    })

    const avoidTopics = prefsDb?.avoidTopics
      ? prefsDb.avoidTopics.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : []
    const hiddenSources = prefsDb?.hiddenSources
      ? prefsDb.hiddenSources.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : []

    let preferences: UserPreferences = {
      id: prefsDb?.id ?? 'default',
      positiveRatio: prefsDb?.positiveRatio ?? 0.4,
      neutralRatio: prefsDb?.neutralRatio ?? 0.4,
      negativeRatio: prefsDb?.negativeRatio ?? 0.2,
      enabledCategories: prefsDb?.enabledCategories
        ? prefsDb.enabledCategories.split(',').filter(Boolean)
        : ['technology', 'science', 'business', 'world', 'positive'],
      refreshIntervalMins: prefsDb?.refreshIntervalMins ?? 60,
      moodPreset: (prefsDb?.moodPreset as MoodPreset) ?? 'balanced',
      avoidTopics,
      hiddenSources,
      sessionSize: prefsDb?.sessionSize ?? 15,
      depthMode: (prefsDb?.depthMode as DepthMode) ?? 'skim',
      enabledSources: prefsDb?.enabledSources
        ? prefsDb.enabledSources.split(',').filter(Boolean)
        : [],
    }

    // Load source weights (applies lazy decay, persists changes)
    const weightMap = await applyDecayAndGetWeightMap()

    // Compute effective negative ratio from TOO_NEGATIVE signals
    const negRatio = await effectiveNegativeRatio(preferences.negativeRatio)
    if (negRatio !== preferences.negativeRatio) {
      // Redistribute the freed capacity proportionally to positive/neutral
      const freed = preferences.negativeRatio - negRatio
      const posNeutralTotal = preferences.positiveRatio + preferences.neutralRatio || 1
      preferences = {
        ...preferences,
        negativeRatio: negRatio,
        positiveRatio: preferences.positiveRatio + freed * (preferences.positiveRatio / posNeutralTotal),
        neutralRatio: preferences.neutralRatio + freed * (preferences.neutralRatio / posNeutralTotal),
      }
    }

    // Get app state
    const appState = await db.appState.findUnique({ where: { id: 'default' } })

    // Get articles
    const allArticles = await db.article.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 500,
    })

    let articles: Article[] = allArticles.map((a) => ({
      ...a,
      sentiment: a.sentiment as 'positive' | 'neutral' | 'negative',
    }))

    // Apply avoidTopics and hiddenSources filters
    if (hiddenSources.length > 0) {
      articles = articles.filter(
        (a) => !hiddenSources.includes(a.source.toLowerCase())
      )
    }
    if (avoidTopics.length > 0) {
      articles = articles.filter((a) => {
        const text = `${a.title} ${a.description ?? ''}`.toLowerCase()
        return !avoidTopics.some((topic) => text.includes(topic))
      })
    }

    // Apply balance filter with source weights
    const filteredArticles = applyBalanceFilter(articles, preferences, category, weightMap)
    const paginatedArticles = filteredArticles.slice(
      (page - 1) * pageSize,
      page * pageSize
    )

    // Get balance stats from ALL articles (not filtered by category)
    const balanceStats = computeBalanceStats(articles)

    // Get top stories
    const topStoriesDb = await db.topStory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    const topStories: TopStory[] = topStoriesDb.map((ts) => ({
      id: ts.id,
      title: ts.title,
      summary: ts.summary,
      category: ts.category,
      articleIds: (() => {
        try {
          return JSON.parse(ts.articleIds) as string[]
        } catch {
          return []
        }
      })(),
      sources: (() => {
        try {
          return JSON.parse(ts.sources) as string[]
        } catch {
          return []
        }
      })(),
      sentiment: ts.sentiment as 'positive' | 'neutral' | 'negative',
      createdAt: ts.createdAt,
    }))

    const hasApiKey = !!process.env.ANTHROPIC_API_KEY

    const response: NewsApiResponse = {
      articles: paginatedArticles,
      topStories,
      balanceStats,
      preferences,
      lastRefreshed: appState?.lastRefreshed?.toISOString() ?? null,
      hasApiKey,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Error in /api/news:', err)
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}
