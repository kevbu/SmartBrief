import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { FeedbackType } from '@/types'

const VALID_FEEDBACK: FeedbackType[] = [
  'more-like-this',
  'less-like-this',
  'too-negative',
  'off-topic',
  'hide-source',
]

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { feedback: string; source?: string }

    if (!VALID_FEEDBACK.includes(body.feedback as FeedbackType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    // Record the feedback
    await db.articleFeedback.create({
      data: {
        articleId: params.id,
        feedback: body.feedback,
        source: body.source ?? null,
      },
    })

    // If hiding a source, add it to hiddenSources in preferences
    if (body.feedback === 'hide-source' && body.source) {
      const prefs = await db.userPreferences.findUnique({ where: { id: 'default' } })
      if (prefs) {
        const current = prefs.hiddenSources
          ? prefs.hiddenSources.split(',').filter(Boolean)
          : []
        if (!current.includes(body.source)) {
          current.push(body.source)
          await db.userPreferences.update({
            where: { id: 'default' },
            data: { hiddenSources: current.join(',') },
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`Error recording feedback for article ${params.id}:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
