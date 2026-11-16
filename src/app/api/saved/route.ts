import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toTopStory } from '@/lib/top-stories'
import type { Article, SavedApiResponse } from '@/types'

function toArticle(row: Awaited<ReturnType<typeof db.article.findMany>>[number]): Article {
  return { ...row, sentiment: row.sentiment as Article['sentiment'] }
}

export async function GET() {
  try {
    const [savedArticles, savedStories] = await Promise.all([
      db.article.findMany({ where: { isSaved: true }, orderBy: { publishedAt: 'desc' } }),
      db.topStory.findMany({ where: { saved: true }, orderBy: { createdAt: 'desc' } }),
    ])

    const topStories = savedStories.map(toTopStory)
    const savedIds = new Set(savedArticles.map((a) => a.id))
    const relatedIds = Array.from(
      new Set(topStories.flatMap((ts) => ts.articleIds).filter((id) => !savedIds.has(id)))
    )
    const relatedArticles =
      relatedIds.length > 0
        ? await db.article.findMany({ where: { id: { in: relatedIds } } })
        : []

    const response: SavedApiResponse = {
      articles: savedArticles.map(toArticle),
      topStories,
      relatedArticles: relatedArticles.map(toArticle),
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error loading saved items:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
