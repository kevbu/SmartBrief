import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertTopicWeight } from '@/lib/topic-weights'
import type { FeedbackType } from '@/types'

const VALID_FEEDBACK: FeedbackType[] = [
  'more-like-this',
  'less-like-this',
  'too-negative',
  'off-topic',
]

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { feedback: string }

    if (!VALID_FEEDBACK.includes(body.feedback as FeedbackType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    const story = await db.topStory.findUnique({
      where: { id: params.id },
      select: { category: true, title: true },
    })

    if (!story) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    // Adjust topic weight based on the cluster's category
    await upsertTopicWeight(story.category, body.feedback as FeedbackType)

    // For negative signals, add the cluster category to avoidTopics if "off-topic"
    if (body.feedback === 'off-topic') {
      const prefs = await db.userPreferences.findUnique({ where: { id: 'default' } })
      if (prefs) {
        const current = prefs.avoidTopics
          ? prefs.avoidTopics.split(',').filter(Boolean)
          : []
        // Use first 3 words of the title as a topic hint
        const topicTag = story.title.split(' ').slice(0, 3).join(' ').toLowerCase()
        if (!current.includes(topicTag)) {
          current.push(topicTag)
          await db.userPreferences.update({
            where: { id: 'default' },
            data: { avoidTopics: current.join(',') },
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`Error recording feedback for top story ${params.id}:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
