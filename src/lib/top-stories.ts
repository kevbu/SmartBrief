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

export function toTopStory(row: TopStoryRow): TopStory {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    articleIds: parseJson<string[]>(row.articleIds, []),
    sources: parseJson<string[]>(row.sources, []),
    bullets: parseJson<string[] | undefined>(row.bullets, undefined),
    clusterArticles: parseJson<Array<{ title: string; source: string; url: string }> | undefined>(
      row.clusterArticles,
      undefined
    ),
    sentiment: row.sentiment as TopStory['sentiment'],
    createdAt: row.createdAt,
    saved: row.saved,
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
