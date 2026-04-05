import type { Article } from '@/types'

// Articles lose ~50% weight after 2 days.
const HALFLIFE_DAYS = 2

function recencyDecay(publishedAt: Date, windowEnd: Date): number {
  const ageDays =
    (windowEnd.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
  return Math.exp(-ageDays / HALFLIFE_DAYS)
}

/**
 * Score and rank articles by importance for catch-up mode.
 *
 * Formula per article:
 *   importanceScore = |sentimentScore| × recencyDecay × categoryBoost
 *
 * categoryBoost: first article encountered per category gets 1.0,
 * subsequent articles in the same category get 0.7 (diversity penalty).
 * Applied in descending base-score order so the best article in each
 * category keeps full weight.
 *
 * @param articles - Candidate articles (pre-filtered by window + balance)
 * @param windowEnd - Reference time for recency decay (typically Date.now())
 */
export function scoreByImportance(
  articles: Article[],
  windowEnd: Date = new Date()
): Array<Article & { importanceScore: number }> {
  // First pass: compute base score (no category boost yet)
  const baseScored = articles.map((article) => ({
    article,
    baseScore:
      Math.abs(article.sentimentScore) *
      recencyDecay(new Date(article.publishedAt), windowEnd),
  }))

  // Sort descending by base score so category boost favours the best per category
  baseScored.sort((a, b) => b.baseScore - a.baseScore)

  // Second pass: apply category boost in rank order
  const seenCategories = new Set<string>()
  return baseScored.map(({ article, baseScore }) => {
    const boost = seenCategories.has(article.category) ? 0.7 : 1.0
    seenCategories.add(article.category)
    return { ...article, importanceScore: baseScore * boost }
  })
}
