import type { Article, UserPreferences, BalanceStats } from '@/types'

function makeSorter(
  weightMap: Record<string, number>,
  topicWeightMap: Record<string, number> = {},
  preferenceWeight: number = 0.3
) {
  return (a: Article, b: Article) => {
    // Blend weights: score = sentimentScore × (1 + pw×(sourceW-1)) × (1 + pw×(topicW-1))
    // When pw=0: score = sentimentScore (learning has no effect)
    // When pw=1: score = sentimentScore × sourceW × topicW (full effect)
    const blendSource = (w: number) => 1 + preferenceWeight * (w - 1)
    const blendTopic  = (w: number) => 1 + preferenceWeight * (w - 1)
    const scoreA =
      a.sentimentScore *
      blendSource(weightMap[a.source] ?? 1.0) *
      blendTopic(topicWeightMap[a.category] ?? 1.0)
    const scoreB =
      b.sentimentScore *
      blendSource(weightMap[b.source] ?? 1.0) *
      blendTopic(topicWeightMap[b.category] ?? 1.0)
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
  weightMap: Record<string, number> = {},
  topicWeightMap: Record<string, number> = {}
): Article[] {
  const pw = preferences.preferenceWeight ?? 0.3
  const hasWeights =
    pw > 0 && (Object.keys(weightMap).length > 0 || Object.keys(topicWeightMap).length > 0)
  const sort = hasWeights ? makeSorter(weightMap, topicWeightMap, pw) : byDate

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

const SOURCE_BOOST_THRESHOLD = 1.1
const SOURCE_SUPPRESS_THRESHOLD = 0.9
const TOPIC_BOOST_THRESHOLD = 1.1
const TOPIC_SUPPRESS_THRESHOLD = 0.9

const CATEGORY_LABELS: Record<string, string> = {
  technology: 'Tech & AI',
  science: 'Science',
  business: 'Business',
  world: 'World News',
  positive: 'Bright Spots',
}

/**
 * Derives a one-line explanation for why an article appeared in the feed.
 * Called per-article after balance filter runs — the same weight maps are reused.
 */
export function computeArticleReason(
  article: Article,
  weightMap: Record<string, number>,
  topicWeightMap: Record<string, number>,
  preferences: UserPreferences
): string {
  const sourceWeight = weightMap[article.source] ?? 1.0
  const topicWeight = topicWeightMap[article.category] ?? 1.0
  const topicLabel = CATEGORY_LABELS[article.category] ?? article.category

  // Suppressed topic included to maintain balance
  if (topicWeight < TOPIC_SUPPRESS_THRESHOLD) {
    return 'Included for balance — you can hide it'
  }

  // Strong source trust
  if (sourceWeight >= SOURCE_BOOST_THRESHOLD) {
    return `From ${article.source} — a source you read often`
  }

  // Soft source suppression note
  if (sourceWeight < SOURCE_SUPPRESS_THRESHOLD) {
    return `From ${article.source} — included for variety`
  }

  // Strong topic affinity
  if (topicWeight >= TOPIC_BOOST_THRESHOLD) {
    return `${topicLabel} — your most-read topic`
  }

  // Sentiment match for constructive preset
  if (article.sentiment === 'positive' && preferences.moodPreset === 'constructive') {
    return 'Positive story — matches your Constructive preset'
  }

  // Default
  return `From ${article.source} — based on your settings`
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
