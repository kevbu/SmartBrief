import type { Article, UserPreferences, BalanceStats } from '@/types'

function makeSorter(weightMap: Record<string, number>) {
  return (a: Article, b: Article) => {
    const scoreA = a.sentimentScore * (weightMap[a.source] ?? 1.0)
    const scoreB = b.sentimentScore * (weightMap[b.source] ?? 1.0)
    if (scoreB !== scoreA) return scoreB - scoreA
    // Tie-break by recency
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  }
}

const byDate = (a: Article, b: Article) =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()

export function applyBalanceFilter(
  articles: Article[],
  preferences: UserPreferences,
  category?: string,
  weightMap: Record<string, number> = {}
): Article[] {
  const hasWeights = Object.keys(weightMap).length > 0
  const sort = hasWeights ? makeSorter(weightMap) : byDate

  // Filter by category first
  let filtered = articles
  if (category && category !== 'all') {
    if (category === 'positive') {
      // Bright Spots: only positive sentiment articles
      return articles
        .filter((a) => a.sentiment === 'positive')
        .sort(sort)
    }
    filtered = articles.filter((a) => a.category === category)
  }

  // Split into sentiment buckets, sorted by adjusted score (or date when no weights)
  const positive = filtered
    .filter((a) => a.sentiment === 'positive')
    .sort(sort)
  const neutral = filtered
    .filter((a) => a.sentiment === 'neutral')
    .sort(sort)
  const negative = filtered
    .filter((a) => a.sentiment === 'negative')
    .sort(sort)

  const total = filtered.length
  if (total === 0) return []

  // Calculate target counts based on ratios
  const targetPositive = Math.round(total * preferences.positiveRatio)
  const targetNeutral = Math.round(total * preferences.neutralRatio)
  const targetNegative = Math.round(total * preferences.negativeRatio)

  // Take from each bucket up to target, but don't exceed available
  const selectedPositive = positive.slice(0, targetPositive)
  const selectedNeutral = neutral.slice(0, targetNeutral)
  const selectedNegative = negative.slice(0, targetNegative)

  // If we're short on one bucket, fill from others
  let remaining =
    total -
    selectedPositive.length -
    selectedNeutral.length -
    selectedNegative.length

  const extraPositive = positive.slice(selectedPositive.length)
  const extraNeutral = neutral.slice(selectedNeutral.length)
  const extraNegative = negative.slice(selectedNegative.length)

  const extras = [...extraNeutral, ...extraPositive, ...extraNegative]
  const fillers = extras.slice(0, remaining)

  const all = [
    ...selectedPositive,
    ...selectedNeutral,
    ...selectedNegative,
    ...fillers,
  ]

  return all.sort(sort)
}

export function computeBalanceStats(articles: Article[]): BalanceStats {
  const total = articles.length
  if (total === 0) {
    return {
      positive: 0,
      neutral: 0,
      negative: 0,
      total: 0,
      positivePercent: 0,
      neutralPercent: 0,
      negativePercent: 0,
    }
  }

  const positive = articles.filter((a) => a.sentiment === 'positive').length
  const neutral = articles.filter((a) => a.sentiment === 'neutral').length
  const negative = articles.filter((a) => a.sentiment === 'negative').length

  return {
    positive,
    neutral,
    negative,
    total,
    positivePercent: Math.round((positive / total) * 100),
    neutralPercent: Math.round((neutral / total) * 100),
    negativePercent: Math.round((negative / total) * 100),
  }
}
