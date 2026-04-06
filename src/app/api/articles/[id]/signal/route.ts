import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertTopicWeight } from '@/lib/topic-weights'

const VALID_ACTIONS = ['skip'] as const
type ImplicitAction = (typeof VALID_ACTIONS)[number]

/**
 * POST /api/articles/[id]/signal
 * Records an implicit learning signal (currently: skip).
 * Unlike explicit feedback, implicit signals have no undo window and
 * don't create an ArticleFeedback record.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as { action: string }

    if (!VALID_ACTIONS.includes(body.action as ImplicitAction)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    const article = await db.article.findUnique({
      where: { id: params.id },
      select: { category: true, source: true, isRead: true },
    })

    // Don't record a skip if the article was already read — article was opened
    if (!article || article.isRead) {
      return NextResponse.json({ success: true })
    }

    await Promise.all([
      db.feedbackSignal.create({
        data: {
          articleId: params.id,
          topic: article.category,
          source: article.source,
          action: body.action,
        },
      }),
      upsertTopicWeight(article.category, body.action),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`Error recording signal for article ${params.id}:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
