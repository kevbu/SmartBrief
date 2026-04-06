import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RecapStats } from '@/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7', 10)

    const since = new Date()
    since.setDate(since.getDate() - days)

    // Get all articles read in the period.
    // Use readAt (when the user opened the article) not fetchedAt (when it was
    // fetched from RSS) — otherwise the recap shows articles from "the past N
    // days of fetching" instead of "the past N days of reading".
    const readArticles = await db.article.findMany({
      where: {
        isRead: true,
        readAt: { not: null, gte: since },
      },
      select: {
        category: true,
        sentiment: true,
        sentimentScore: true,
        source: true,
      },
    })

    const total = readArticles.length

    // Topic mix
    const topicMix: Record<string, number> = {}
    for (const a of readArticles) {
      topicMix[a.category] = (topicMix[a.category] ?? 0) + 1
    }

    // Sentiment mix
    const sentimentMix = { positive: 0, neutral: 0, negative: 0 }
    let totalScore = 0
    for (const a of readArticles) {
      if (a.sentiment === 'positive') sentimentMix.positive++
      else if (a.sentiment === 'negative') sentimentMix.negative++
      else sentimentMix.neutral++
      totalScore += a.sentimentScore
    }

    // Source mix (top 10)
    const sourceMixRaw: Record<string, number> = {}
    for (const a of readArticles) {
      sourceMixRaw[a.source] = (sourceMixRaw[a.source] ?? 0) + 1
    }
    const sourceMix: Record<string, number> = Object.fromEntries(
      Object.entries(sourceMixRaw)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    )

    const stats: RecapStats = {
      totalRead: total,
      topicMix,
      sentimentMix,
      sourceMix,
      avgSentimentScore: total > 0 ? totalScore / total : 0,
      periodDays: days,
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
