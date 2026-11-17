import { parseArticleIds } from './top-stories'

/**
 * Article retention (#31). Pure selection logic; the DB side lives in
 * `pruneOldArticles()` in news-aggregator.ts.
 */

export const DEFAULT_RETENTION_DAYS = 30
/** effectiveNegativeRatio() counts the last 30 days of ArticleFeedback. */
export const FEEDBACK_MIN_RETENTION_DAYS = 30
/** Stays well below SQLite's bound-variable limit. */
export const PRUNE_CHUNK_SIZE = 500

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Parses SMARTBRIEF_RETENTION_DAYS. Unset or empty gives the default.
 * `0` turns retention off. Anything other than a non-negative integer
 * gives the default with `valid: false`, so the caller can warn.
 */
export function parseRetentionDays(raw: string | undefined): { days: number; valid: boolean } {
  const value = raw?.trim()
  if (!value) return { days: DEFAULT_RETENTION_DAYS, valid: true }
  if (!/^\d+$/.test(value)) return { days: DEFAULT_RETENTION_DAYS, valid: false }
  return { days: Number(value), valid: true }
}

export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY)
}

/**
 * Orphaned feedback is kept at least FEEDBACK_MIN_RETENTION_DAYS, even with a
 * shorter article window, so the learned negative-ratio cap does not shift.
 */
export function feedbackCutoff(now: Date, days: number): Date {
  return retentionCutoff(now, Math.max(days, FEEDBACK_MIN_RETENTION_DAYS))
}

/**
 * Ingest guard for RSS items. An item published before the cutoff would be
 * pruned again on the next refresh, so it is not inserted. This also stops a
 * feed that still serves a pruned URL from re-adding it. `cutoff = null`
 * means retention is off. Invalid dates are kept (previous behaviour).
 */
export function shouldIngest(publishedAt: Date, cutoff: Date | null): boolean {
  if (!cutoff) return true
  return !(publishedAt.getTime() < cutoff.getTime())
}

/**
 * Article ids referenced by any of the given clusters. `unparseable` counts
 * clusters with a non-empty `articleIds` that is not a JSON array; the caller
 * must then skip the prune (fail closed), because such a cluster protects
 * nothing.
 */
export function collectProtectedArticleIds(stories: { articleIds: string | null }[]): {
  ids: Set<string>
  unparseable: number
} {
  const ids = new Set<string>()
  let unparseable = 0
  for (const story of stories) {
    const raw = story.articleIds?.trim()
    if (!raw) continue
    if (!isJsonArray(raw)) {
      unparseable++
      continue
    }
    for (const id of parseArticleIds(raw)) ids.add(id)
  }
  return { ids, unparseable }
}

function isJsonArray(raw: string): boolean {
  try {
    return Array.isArray(JSON.parse(raw))
  } catch {
    return false
  }
}

export interface PruneCandidate {
  id: string
  isSaved: boolean
  publishedAt: Date
  fetchedAt: Date
  readAt: Date | null
}

/**
 * An article is prunable only when it is not saved, not referenced by a
 * remaining cluster, and was published, fetched and (if ever) read before
 * the cutoff.
 */
export function isPrunable(
  article: PruneCandidate,
  protectedIds: Set<string>,
  cutoff: Date
): boolean {
  const limit = cutoff.getTime()
  if (article.isSaved) return false
  if (protectedIds.has(article.id)) return false
  if (!(article.publishedAt.getTime() < limit)) return false
  if (!(article.fetchedAt.getTime() < limit)) return false
  if (article.readAt && !(article.readAt.getTime() < limit)) return false
  return true
}

export function selectArticlesToPrune(
  candidates: PruneCandidate[],
  protectedIds: Set<string>,
  cutoff: Date
): string[] {
  return candidates.filter((a) => isPrunable(a, protectedIds, cutoff)).map((a) => a.id)
}

/** Article ids from feedback rows whose article no longer exists, deduped. */
export function selectOrphanedFeedbackArticleIds(
  feedbackArticleIds: string[],
  existingIds: Set<string>
): string[] {
  return [...new Set(feedbackArticleIds)].filter((id) => !existingIds.has(id))
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be >= 1')
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
