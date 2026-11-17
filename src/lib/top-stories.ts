import type { TopStory as TopStoryRow } from '@prisma/client'
import type { TopStory } from '@/types'

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/** Parses the JSON `articleIds` column; malformed or non-array values give []. */
export function parseArticleIds(value: string | null | undefined): string[] {
  const parsed = parseJson<unknown>(value, [])
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
}

export function toTopStory(row: TopStoryRow): TopStory {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    articleIds: parseArticleIds(row.articleIds),
    sources: parseJson<string[]>(row.sources, []),
    bullets: parseJson<string[] | undefined>(row.bullets, undefined),
    clusterArticles: parseJson<Array<{ title: string; source: string; url: string }> | undefined>(
      row.clusterArticles,
      undefined
    ),
    sentiment: row.sentiment as TopStory['sentiment'],
    createdAt: row.createdAt,
    saved: row.saved,
    savedAt: row.savedAt,
  }
}

/**
 * Every refresh stamps its clusters with one shared createdAt. The newest
 * timestamp is the current batch; older rows are saved clusters kept from
 * earlier refreshes and belong on /saved, not in the feed.
 */
export function selectCurrentBatch<T extends { createdAt: Date }>(rows: T[]): T[] {
  if (rows.length === 0) return []
  const newest = Math.max(...rows.map((r) => r.createdAt.getTime()))
  return rows.filter((r) => r.createdAt.getTime() === newest)
}

/**
 * Applies the user's hidden sources and avoid topics to feed clusters (#16).
 * Both lists must already be lowercased.
 * - Drops a cluster only when EVERY source is hidden. Clusters with partial
 *   overlap stay, they aggregate cross-source coverage on purpose. A cluster
 *   without sources is never dropped by this rule.
 * - Drops a cluster when its title contains an avoid topic (same `includes`
 *   logic as the article filter).
 * Deliberately not intersected with the article list, so clusters do not
 * disappear mid-session as articles get marked read.
 */
export function filterTopStoriesForFeed<T extends { title: string; sources: string[] }>(
  stories: T[],
  hiddenSources: string[],
  avoidTopics: string[]
): T[] {
  if (hiddenSources.length === 0 && avoidTopics.length === 0) return stories
  const hidden = new Set(hiddenSources)
  return stories.filter((story) => {
    if (
      hidden.size > 0 &&
      story.sources.length > 0 &&
      story.sources.every((s) => hidden.has(s.trim().toLowerCase()))
    ) {
      return false
    }
    const title = story.title.toLowerCase()
    return !avoidTopics.some((topic) => title.includes(topic))
  })
}

/**
 * Overlap of two article-id lists. `coefficient` is shared / min(|A|, |B|)
 * (overlap coefficient), so a cluster that grew keeps a high score.
 */
export function articleOverlap(a: string[], b: string[]): { shared: number; coefficient: number } {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size === 0 || setB.size === 0) return { shared: 0, coefficient: 0 }
  let shared = 0
  for (const id of setA) if (setB.has(id)) shared++
  return { shared, coefficient: shared / Math.min(setA.size, setB.size) }
}

export const REBUILD_MIN_SHARED = 2
export const REBUILD_MIN_COEFFICIENT = 0.6

/**
 * Finds which newly generated clusters continue a saved cluster (#29), so a
 * refresh updates the saved row instead of adding a duplicate next to it.
 * Returns a map from the index in `newClusters` to the saved row id.
 * A pair qualifies with >= 2 shared articles and an overlap coefficient
 * >= 0.6. Assignment is one-to-one and greedy: most shared articles first,
 * then higher coefficient, then input order. Ranking by shared count stops a
 * small fragment (coefficient 1.0 by construction) from beating the real,
 * grown continuation of a saved cluster.
 */
export function matchRebuiltClusters(
  newClusters: { articleIds: string[] }[],
  saved: { id: string; articleIds: string[] }[]
): Map<number, string> {
  const candidates: { newIdx: number; savedIdx: number; shared: number; coefficient: number }[] = []
  newClusters.forEach((cluster, newIdx) => {
    saved.forEach((row, savedIdx) => {
      const { shared, coefficient } = articleOverlap(cluster.articleIds, row.articleIds)
      if (shared >= REBUILD_MIN_SHARED && coefficient >= REBUILD_MIN_COEFFICIENT) {
        candidates.push({ newIdx, savedIdx, shared, coefficient })
      }
    })
  })
  candidates.sort(
    (x, y) =>
      y.shared - x.shared ||
      y.coefficient - x.coefficient ||
      x.newIdx - y.newIdx ||
      x.savedIdx - y.savedIdx
  )
  const result = new Map<number, string>()
  const usedSaved = new Set<number>()
  for (const c of candidates) {
    if (result.has(c.newIdx) || usedSaved.has(c.savedIdx)) continue
    result.set(c.newIdx, saved[c.savedIdx].id)
    usedSaved.add(c.savedIdx)
  }
  return result
}

/**
 * Orders saved items by save time, newest first (#30). Rows without a
 * savedAt (saved before the column existed) follow in their input order,
 * so the caller's query order is the fallback.
 */
export function sortBySavedAt<T extends { savedAt: Date | null }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ta = a.row.savedAt?.getTime()
      const tb = b.row.savedAt?.getTime()
      if (ta !== undefined && tb !== undefined) return tb - ta || a.index - b.index
      if (ta !== undefined) return -1
      if (tb !== undefined) return 1
      return a.index - b.index
    })
    .map(({ row }) => row)
}
