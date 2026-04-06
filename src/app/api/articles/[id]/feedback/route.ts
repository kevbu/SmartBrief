import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertSourceWeight, reverseSourceWeight } from '@/lib/source-weights'
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

    // These feedback types affect source weights — source is required
    const WEIGHT_SIGNALS: FeedbackType[] = ['more-like-this', 'less-like-this', 'too-negative']
    if (WEIGHT_SIGNALS.includes(body.feedback as FeedbackType) && !body.source) {
      return NextResponse.json(
        { success: false, error: 'source is required for this feedback type' },
        { status: 400 }
      )
    }

    // Record the feedback — return the ID so the client can undo within 5 s
    const record = await db.articleFeedback.create({
      data: {
        articleId: params.id,
        feedback: body.feedback,
        source: body.source ?? null,
      },
    })

    // Update source weight based on feedback signal
    await upsertSourceWeight(body.source, body.feedback)

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

    return NextResponse.json({ success: true, feedbackId: record.id })
  } catch (err) {
    console.error(`Error recording feedback for article ${params.id}:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/articles/[id]/feedback?feedbackId=<id>
 * Undo a feedback submission within the 5-second undo window.
 * Reverses source weight and hiddenSources side effects.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url)
    const feedbackId = url.searchParams.get('feedbackId')

    if (!feedbackId) {
      return NextResponse.json({ success: false, error: 'feedbackId required' }, { status: 400 })
    }

    const record = await db.articleFeedback.findUnique({ where: { id: feedbackId } })

    // If the record doesn't exist it was already deleted — treat as success
    if (!record) {
      return NextResponse.json({ success: true })
    }

    // Ensure the record belongs to the requested article
    if (record.articleId !== params.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await db.articleFeedback.delete({ where: { id: feedbackId } })

    // Reverse source weight
    await reverseSourceWeight(record.source, record.feedback)

    // If the undone signal was hide-source, remove from hiddenSources
    if (record.feedback === 'hide-source' && record.source) {
      const prefs = await db.userPreferences.findUnique({ where: { id: 'default' } })
      if (prefs) {
        const current = prefs.hiddenSources
          ? prefs.hiddenSources.split(',').filter(Boolean)
          : []
        const updated = current.filter((s) => s !== record.source)
        await db.userPreferences.update({
          where: { id: 'default' },
          data: { hiddenSources: updated.join(',') },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`Error undoing feedback for article ${params.id}:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
