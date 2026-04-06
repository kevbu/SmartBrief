import { db } from '@/lib/db'
import type { FeedbackType } from '@/types'

const SIGNAL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // run at most once per day
let lastCleanupAt = 0

/**
 * Deletes FeedbackSignal rows older than 90 days.
 * Throttled to run at most once per process-day via module-level timestamp.
 */
export async function runSignalCleanupIfNeeded(): Promise<void> {
  const now = Date.now()
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return
  lastCleanupAt = now

  const cutoff = new Date(now - SIGNAL_RETENTION_MS)
  const { count } = await db.feedbackSignal.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  if (count > 0) {
    console.log(`[signal-cleanup] deleted ${count} signals older than 90 days`)
  }
}

// Which explicit feedback actions shift topic weights, and by how much.
// 'too-negative' and 'hide-source' are sentiment/source signals — no topic effect.
const WEIGHT_DELTA: Partial<Record<FeedbackType | 'read' | 'skip', number>> = {
  'more-like-this': 0.15,
  'less-like-this': -0.15,
  'off-topic': -0.10,
  'read': 0.02,
  'skip': -0.02,
}

const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 2.0
const DECAY_RATE = 0.9 // per 30-day period
const NEUTRAL_SNAP_LOW = 0.95
const NEUTRAL_SNAP_HIGH = 1.05
const MS_PER_30_DAYS = 1000 * 60 * 60 * 24 * 30

function clamp(v: number): number {
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, v))
}

function applyDecay(weight: number, lastAdjusted: Date): number {
  const monthsSince = (Date.now() - lastAdjusted.getTime()) / MS_PER_30_DAYS
  const decayed = clamp(weight * Math.pow(DECAY_RATE, monthsSince))
  return decayed > NEUTRAL_SNAP_LOW && decayed < NEUTRAL_SNAP_HIGH ? 1.0 : decayed
}

/**
 * Upserts a topic weight based on a feedback or implicit signal action.
 * No-ops for actions with no delta (too-negative, hide-source).
 */
export async function upsertTopicWeight(
  topic: string | null | undefined,
  action: string
): Promise<void> {
  if (!topic) return
  const delta = WEIGHT_DELTA[action as keyof typeof WEIGHT_DELTA]
  if (delta === undefined) return

  const existing = await db.topicWeight.findUnique({ where: { topic } })

  if (existing) {
    const newWeight = clamp(existing.weight + delta)
    await db.topicWeight.update({
      where: { topic },
      data: { weight: newWeight, lastAdjusted: new Date() },
    })
  } else {
    await db.topicWeight.create({
      data: {
        topic,
        weight: clamp(1.0 + delta),
        lastAdjusted: new Date(),
      },
    })
  }
}

/**
 * Reverses a previously applied topic weight adjustment (called on feedback undo).
 */
export async function reverseTopicWeight(
  topic: string | null | undefined,
  action: string
): Promise<void> {
  if (!topic) return
  const delta = WEIGHT_DELTA[action as keyof typeof WEIGHT_DELTA]
  if (delta === undefined) return

  const existing = await db.topicWeight.findUnique({ where: { topic } })
  if (!existing) return

  const newWeight = clamp(existing.weight - delta)
  await db.topicWeight.update({
    where: { topic },
    data: { weight: newWeight, lastAdjusted: new Date() },
  })
}

/**
 * Fetches all TopicWeight rows, applies lazy decay, persists changed weights,
 * and returns a Record<topic, effectiveWeight> ready for ranking.
 * Topics with no row default to 1.0 at call sites.
 */
export async function applyDecayAndGetTopicWeightMap(): Promise<Record<string, number>> {
  const rows = await db.topicWeight.findMany()
  if (rows.length === 0) return {}

  const updates: Promise<unknown>[] = []
  const weightMap: Record<string, number> = {}

  for (const row of rows) {
    const decayed = applyDecay(row.weight, row.lastAdjusted)
    weightMap[row.topic] = decayed

    if (Math.abs(decayed - row.weight) > 0.0001) {
      updates.push(
        db.topicWeight.update({
          where: { topic: row.topic },
          data: { weight: decayed, lastAdjusted: new Date() },
        })
      )
    }
  }

  if (updates.length > 0) await Promise.all(updates)

  return weightMap
}
