import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BOOST_THRESHOLD = 1.05
const SUPPRESS_THRESHOLD = 0.95

export interface LearnedPreferencesResponse {
  boostedTopics: Array<{ topic: string; weight: number }>
  suppressedTopics: Array<{ topic: string; weight: number }>
  suppressedSources: string[]
  signalCount: number
}

/**
 * GET /api/preferences/learned
 * Returns a shaped view of learned topic/source weights for the settings UI.
 */
export async function GET() {
  try {
    const [topicWeights, prefs, signalCount] = await Promise.all([
      db.topicWeight.findMany({ orderBy: { weight: 'desc' } }),
      db.userPreferences.findUnique({ where: { id: 'default' } }),
      db.feedbackSignal.count(),
    ])

    const boostedTopics = topicWeights
      .filter((t) => t.weight >= BOOST_THRESHOLD)
      .map((t) => ({ topic: t.topic, weight: Math.round(t.weight * 100) / 100 }))
      .slice(0, 3)

    const suppressedTopics = topicWeights
      .filter((t) => t.weight < SUPPRESS_THRESHOLD)
      .sort((a, b) => a.weight - b.weight)
      .map((t) => ({ topic: t.topic, weight: Math.round(t.weight * 100) / 100 }))
      .slice(0, 3)

    const suppressedSources = prefs?.hiddenSources
      ? prefs.hiddenSources.split(',').filter(Boolean)
      : []

    const response: LearnedPreferencesResponse = {
      boostedTopics,
      suppressedTopics,
      suppressedSources,
      signalCount,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Error fetching learned preferences:', err)
    return NextResponse.json({ error: 'Failed to fetch learned preferences' }, { status: 500 })
  }
}

/**
 * DELETE /api/preferences/learned
 * Reset learned preferences.
 *
 * Query params:
 *   ?type=topic&value=technology  — reset a specific topic weight
 *   ?type=source&value=bbc-news   — unhide a specific source
 *   ?all=true                     — clear all topic weights + feedback signals
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const all = url.searchParams.get('all')
    const type = url.searchParams.get('type')
    const value = url.searchParams.get('value')

    if (all === 'true') {
      // Nuclear reset: clear all topic weights and feedback signals
      await Promise.all([
        db.topicWeight.deleteMany({}),
        db.sourceWeight.deleteMany({}),
        db.feedbackSignal.deleteMany({}),
      ])
      return NextResponse.json({ success: true, action: 'reset-all' })
    }

    if (type === 'topic' && value) {
      await db.topicWeight.deleteMany({ where: { topic: value } })
      return NextResponse.json({ success: true, action: 'reset-topic', value })
    }

    if (type === 'source' && value) {
      // Removing a hidden source restores it to the feed
      const prefs = await db.userPreferences.findUnique({ where: { id: 'default' } })
      if (prefs) {
        const current = prefs.hiddenSources
          ? prefs.hiddenSources.split(',').filter(Boolean)
          : []
        const updated = current.filter((s) => s !== value)
        await db.userPreferences.update({
          where: { id: 'default' },
          data: { hiddenSources: updated.join(',') },
        })
      }
      // Also reset any soft-suppress source weight
      await db.sourceWeight.deleteMany({ where: { source: value } })
      return NextResponse.json({ success: true, action: 'reset-source', value })
    }

    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  } catch (err) {
    console.error('Error resetting learned preferences:', err)
    return NextResponse.json({ error: 'Failed to reset' }, { status: 500 })
  }
}
