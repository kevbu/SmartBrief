import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertTopicWeight } from '@/lib/topic-weights'
import type { ArticleActionResponse } from '@/types'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const article = await db.article.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })

    // Write implicit read signal — fire-and-forget, don't block response
    void Promise.all([
      db.feedbackSignal.create({
        data: {
          articleId: id,
          topic: article.category,
          source: article.source,
          action: 'read',
        },
      }),
      upsertTopicWeight(article.category, 'read'),
    ]).catch((e) => console.error('[read-signal] failed to write:', e))

    const response: ArticleActionResponse = {
      success: true,
      article: {
        ...article,
        sentiment: article.sentiment as 'positive' | 'neutral' | 'negative',
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error(`Error marking article ${id} as read:`, err)
    const response: ArticleActionResponse = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
    return NextResponse.json(response, { status: 500 })
  }
}
