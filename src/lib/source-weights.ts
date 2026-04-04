import { db } from '@/lib/db'
import type { FeedbackType } from '@/types'

const WEIGHT_DELTA: Partial<Record<FeedbackType, number>> = {
  'more-like-this': 0.15,
  'less-like-this': -0.15,
  'too-negative': -0.05,
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
 * Called after ArticleFeedback insert. Upserts the source weight for signals
 * that affect source ranking. No-ops for signals with no delta (off-topic,
 * hide-source).
 */
export async function upsertSourceWeight(
  source: string | null | undefined,
  feedbackType: string
): Promise<void> {
  if (!source) return
  const delta = WEIGHT_DELTA[feedbackType as FeedbackType]
  if (delta === undefined) return

  const existing = await db.sourceWeight.findUnique({ where: { source } })

  if (existing) {
    const newWeight = clamp(existing.weight + delta)
    await db.sourceWeight.update({
      where: { source },
      data: { weight: newWeight, lastAdjusted: new Date() },
    })
  } else {
    await db.sourceWeight.create({
      data: {
        source,
        weight: clamp(1.0 + delta),
        lastAdjusted: new Date(),
      },
    })
  }
}

/**
 * Fetches all SourceWeight rows, applies lazy decay, persists changed weights,
 * and returns a Record<source, effectiveWeight> ready for ranking.
 * Sources with no row default to 1.0 at call sites.
 */
export async function applyDecayAndGetWeightMap(): Promise<Record<string, number>> {
  const rows = await db.sourceWeight.findMany()
  if (rows.length === 0) return {}

  const updates: Promise<unknown>[] = []
  const weightMap: Record<string, number> = {}

  for (const row of rows) {
    const decayed = applyDecay(row.weight, row.lastAdjusted)
    weightMap[row.source] = decayed

    if (Math.abs(decayed - row.weight) > 0.0001) {
      updates.push(
        db.sourceWeight.update({
          where: { source: row.source },
          data: { weight: decayed, lastAdjusted: new Date() },
        })
      )
    }
  }

  if (updates.length > 0) await Promise.all(updates)

  return weightMap
}

/**
 * Counts TOO_NEGATIVE feedback signals in the last 30 days and returns the
 * effective negative ratio cap: max(0.05, presetNegativeRatio - count * 0.02).
 */
export async function effectiveNegativeRatio(presetNegativeRatio: number): Promise<number> {
  const since = new Date(Date.now() - MS_PER_30_DAYS)
  const count = await db.articleFeedback.count({
    where: { feedback: 'too-negative', createdAt: { gte: since } },
  })
  return Math.max(0.05, presetNegativeRatio - count * 0.02)
}
