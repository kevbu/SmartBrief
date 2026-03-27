import type { Article, UserPreferences, BalanceStats } from '@/types'

export function applyBalanceFilter(
  articles: Article[],
  preferences: UserPreferences,
  category?: string
): Article[] {
  // Filter by category first
  let filtered = articles
  if (category && category !== 'all') {
    if (category === 'positive') {
      // Bright Spots: only positive sentiment articles
      return articles
        .filter((a) => a.sentiment === 'positive')
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        )
    }
    filtered = articles.filter((a) => a.category === category)
  }

  // Split into sentiment buckets, sorted by date
  const positive = filtered
    .filter((a) => a.sentiment === 'positive')
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  const neutral = filtered
    .filter((a) => a.sentiment === 'neutral')
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  const negative = filtered
    .filter((a) => a.sentiment === 'negative')
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )

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

  // Sort combined result by date
  return all.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
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
