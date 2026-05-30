import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applyBalanceFilter, computeBalanceStats, computeArticleReason } from '@/lib/balance-filter'
import { ensureDefaultPreferences } from '@/lib/news-aggregator'
import { applyDecayAndGetWeightMap, effectiveNegativeRatio } from '@/lib/source-weights'
import { applyDecayAndGetTopicWeightMap } from '@/lib/topic-weights'
import { scoreByImportance } from '@/lib/importance-score'
import type { Article, TopStory, UserPreferences, NewsApiResponse, MoodPreset, DepthMode } from '@/types'

export async function GET(request: Request) {
  const t0 = Date.now()
  try {
    await ensureDefaultPreferences()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'all'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const mode = searchParams.get('mode') === 'catchup' ? 'catchup' : 'standard'
    const sinceParam = searchParams.get('since')
    const sinceDate = mode === 'catchup' && sinceParam ? new Date(sinceParam) : null

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
      pushEnabled: prefsDb?.pushEnabled ?? false,
      quietHoursEnabled: prefsDb?.quietHoursEnabled ?? false,
      quietHoursStart: prefsDb?.quietHoursStart ?? '22:00',
      quietHoursEnd: prefsDb?.quietHoursEnd ?? '07:00',
      learningEnabled: prefsDb?.learningEnabled ?? true,
      preferenceWeight: prefsDb?.preferenceWeight ?? 0.3,
    }

    // Load everything that doesn't depend on weights/negRatio in parallel
    const [weightMap, topicWeightMap, negRatio, appState, allArticles, topStoriesDb] = await Promise.all([
      applyDecayAndGetWeightMap(),
      prefsDb?.learningEnabled !== false ? applyDecayAndGetTopicWeightMap() : Promise.resolve({}),
      effectiveNegativeRatio(preferences.negativeRatio),
      db.appState.findUnique({ where: { id: 'default' } }),
      db.article.findMany({
        where: sinceDate ? { publishedAt: { gte: sinceDate } } : undefined,
        orderBy: { publishedAt: 'desc' },
        take: 500,
      }),
      db.topStory.findMany({ orderBy: { createdAt: 'desc' } }),
    ])

    // Adjust ratios based on TOO_NEGATIVE signals
    if (negRatio !== preferences.negativeRatio) {
      const freed = preferences.negativeRatio - negRatio
      const posNeutralTotal = preferences.positiveRatio + preferences.neutralRatio || 1
      preferences = {
        ...preferences,
        negativeRatio: negRatio,
        positiveRatio: preferences.positiveRatio + freed * (preferences.positiveRatio / posNeutralTotal),
        neutralRatio: preferences.neutralRatio + freed * (preferences.neutralRatio / posNeutralTotal),
      }
    }

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

    // Apply balance filter with source and topic weights
    const balanceFiltered = applyBalanceFilter(articles, preferences, category, weightMap, topicWeightMap)

    // Attach reason strings (only computed when learning is active and weights exist)
    const hasLearningData =
      preferences.learningEnabled &&
      (Object.keys(weightMap).length > 0 || Object.keys(topicWeightMap).length > 0)
    if (hasLearningData) {
      for (const article of balanceFiltered) {
        article.reason = computeArticleReason(article, weightMap, topicWeightMap, preferences)
      }
    }

    let paginatedArticles: Article[]
    if (mode === 'catchup') {
      // Score by importance, cap at min(20, sessionSize)
      const catchUpLimit = Math.min(20, preferences.sessionSize)
      const scored = scoreByImportance(balanceFiltered)
      paginatedArticles = scored.slice(0, catchUpLimit)
    } else {
      paginatedArticles = balanceFiltered.slice(
        (page - 1) * pageSize,
        page * pageSize
      )
    }

    // Get balance stats from ALL articles (not filtered by category)
    const balanceStats = computeBalanceStats(articles)

    const topStories: TopStory[] = topStoriesDb
      .map((ts) => ({
        id: ts.id,
        title: ts.title,
        summary: ts.summary,
        category: ts.category,
        articleIds: (() => {
          try { return JSON.parse(ts.articleIds) as string[] } catch { return [] }
        })(),
        sources: (() => {
          try { return JSON.parse(ts.sources) as string[] } catch { return [] }
        })(),
        bullets: (() => {
          try { return ts.bullets ? JSON.parse(ts.bullets) as string[] : undefined } catch { return undefined }
        })(),
        clusterArticles: (() => {
          try { return ts.clusterArticles ? JSON.parse(ts.clusterArticles) as Array<{ title: string; source: string; url: string }> : undefined } catch { return undefined }
        })(),
        sentiment: ts.sentiment as 'positive' | 'neutral' | 'negative',
        createdAt: ts.createdAt,
      }))
      .sort((a, b) => b.sources.length - a.sources.length)

    const hasApiKey = !!process.env.ANTHROPIC_API_KEY

    const response: NewsApiResponse = {
      articles: paginatedArticles,
      topStories,
      balanceStats,
      preferences,
      lastRefreshed: appState?.lastRefreshed?.toISOString() ?? null,
      hasApiKey,
      ...(mode === 'catchup' && sinceDate
        ? {
            catchUpContext: {
              active: true,
              gapDays: Math.round(
                (Date.now() - sinceDate.getTime()) / (1000 * 60 * 60 * 24)
              ),
              windowStart: sinceDate.toISOString(),
              articleCount: paginatedArticles.length,
            },
          }
        : {}),
    }

    console.log(`[/api/news] ${Date.now() - t0}ms (category=${category}, mode=${mode})`)
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error in /api/news:', err)
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}
