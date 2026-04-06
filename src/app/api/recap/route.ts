import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { NEWS_SOURCES } from '@/lib/news-sources'
import type { RecapStats, RecapFeedbackSummary } from '@/types'

// Build a source-name → bias map once at module load for O(1) lookups
const BIAS_BY_SOURCE = new Map(
  NEWS_SOURCES.map((s) => [s.name.toLowerCase(), s.bias])
)

const BIAS_KEYS = ['left', 'center-left', 'center', 'center-right', 'right'] as const

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7', 10)

    const since = new Date()
    since.setDate(since.getDate() - days)

    // Run article query and feedback queries in parallel
    const [readArticles, feedbackRows, prefs] = await Promise.all([
      db.article.findMany({
        where: { isRead: true, readAt: { not: null, gte: since } },
        select: {
          category: true,
          sentiment: true,
          sentimentScore: true,
          source: true,
          readAt: true,
        },
      }),
      db.articleFeedback.findMany({
        where: { createdAt: { gte: since } },
        select: { feedback: true, articleId: true },
      }),
      db.userPreferences.findUnique({
        where: { id: 'default' },
        select: { hiddenSources: true },
      }),
    ])

    const total = readArticles.length

    // ── Topic mix ───────────────────────────────────────────────────────────
    const topicMix: Record<string, number> = {}
    for (const a of readArticles) {
      topicMix[a.category] = (topicMix[a.category] ?? 0) + 1
    }

    // ── Sentiment mix ───────────────────────────────────────────────────────
    const sentimentMix = { positive: 0, neutral: 0, negative: 0 }
    let totalScore = 0
    for (const a of readArticles) {
      if (a.sentiment === 'positive') sentimentMix.positive++
      else if (a.sentiment === 'negative') sentimentMix.negative++
      else sentimentMix.neutral++
      totalScore += a.sentimentScore
    }

    // ── Source mix (top 10) ─────────────────────────────────────────────────
    const sourceMixRaw: Record<string, number> = {}
    for (const a of readArticles) {
      sourceMixRaw[a.source] = (sourceMixRaw[a.source] ?? 0) + 1
    }
    const sourceMix: Record<string, number> = Object.fromEntries(
      Object.entries(sourceMixRaw).sort(([, a], [, b]) => b - a).slice(0, 10)
    )

    // ── Days active ─────────────────────────────────────────────────────────
    const readDays = new Set<string>()
    for (const a of readArticles) {
      if (a.readAt) {
        // Group by YYYY-MM-DD in local (server) timezone
        readDays.add(a.readAt.toISOString().slice(0, 10))
      }
    }
    const daysActive = readDays.size

    // ── Bias mix ────────────────────────────────────────────────────────────
    const biasMix: Record<string, number> = Object.fromEntries(
      BIAS_KEYS.map((k) => [k, 0])
    )
    for (const a of readArticles) {
      const bias = BIAS_BY_SOURCE.get(a.source.toLowerCase()) ?? 'center'
      biasMix[bias] = (biasMix[bias] ?? 0) + 1
    }

    // ── Feedback summary ────────────────────────────────────────────────────
    let moreLikeThis = 0
    let lessLikeThis = 0
    const lessLikeThisArticleIds: string[] = []

    for (const f of feedbackRows) {
      if (f.feedback === 'more-like-this') moreLikeThis++
      else if (f.feedback === 'less-like-this') {
        lessLikeThis++
        lessLikeThisArticleIds.push(f.articleId)
      }
    }

    // Find topics with ≥3 "less like this" signals — needs article lookup
    let topicNudges: string[] = []
    if (lessLikeThisArticleIds.length >= 3) {
      const negArticles = await db.article.findMany({
        where: { id: { in: lessLikeThisArticleIds } },
        select: { id: true, category: true },
      })
      const categoryByArticleId = new Map(negArticles.map((a) => [a.id, a.category]))
      const topicCounts: Record<string, number> = {}
      for (const articleId of lessLikeThisArticleIds) {
        const cat = categoryByArticleId.get(articleId)
        if (cat) topicCounts[cat] = (topicCounts[cat] ?? 0) + 1
      }
      topicNudges = Object.entries(topicCounts)
        .filter(([, count]) => count >= 3)
        .map(([topic]) => topic)
    }

    const hiddenSourceCount = prefs?.hiddenSources
      ? prefs.hiddenSources.split(',').filter(Boolean).length
      : 0

    const feedbackSummary: RecapFeedbackSummary = {
      moreLikeThis,
      lessLikeThis,
      hiddenSourceCount,
      topicNudges,
    }

    const stats: RecapStats = {
      totalRead: total,
      topicMix,
      sentimentMix,
      sourceMix,
      avgSentimentScore: total > 0 ? totalScore / total : 0,
      periodDays: days,
      daysActive,
      biasMix,
      feedbackSummary,
    }

    return NextResponse.json({ success: true, stats })
  } catch (err) {
    console.error('Error fetching recap:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recap stats' },
      { status: 500 }
    )
  }
}
