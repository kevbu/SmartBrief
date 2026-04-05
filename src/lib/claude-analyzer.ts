import Anthropic from '@anthropic-ai/sdk'
import type { Article, SentimentResult, SentimentType, TopStory } from '@/types'

export type SeverityLevel = 'routine' | 'notable' | 'significant' | 'major' | 'critical'

export interface SeverityResult {
  id: string
  severity: SeverityLevel
}

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

export async function analyzeSentiment(
  articles: Pick<Article, 'id' | 'title' | 'description'>[]
): Promise<SentimentResult[]> {
  const client = getClient()

  if (!client) {
    // Graceful degradation: return neutral for all
    return articles.map((a) => ({ id: a.id, sentiment: 'neutral', score: 0 }))
  }

  // Process in batches of 20
  const results: SentimentResult[] = []

  for (let i = 0; i < articles.length; i += 20) {
    const batch = articles.slice(i, i + 20)
    const batchResults = await analyzeBatch(client, batch)
    results.push(...batchResults)
  }

  return results
}

async function analyzeBatch(
  client: Anthropic,
  articles: Pick<Article, 'id' | 'title' | 'description'>[]
): Promise<SentimentResult[]> {
  const articleList = articles
    .map(
      (a, idx) =>
        `${idx + 1}. ID: ${a.id}\nTitle: ${a.title}\nDescription: ${a.description || 'No description'}`
    )
    .join('\n\n')

  const prompt = `Analyze these ${articles.length} news articles. For each article, return:
- sentiment: "positive", "neutral", or "negative"
- score: a float from -1.0 (very negative) to 1.0 (very positive), 0 = neutral
- severity: urgency level — one of: routine | notable | significant | major | critical
  (critical = immediate large-scale threat to life, safety, financial systems, or democratic institutions — e.g. active conflict escalation, 7.5+ earthquake in populated area, exchange trading halt, head-of-state death/coup. major = serious but not immediate. significant = newsworthy. notable = mildly interesting. routine = everyday news.)

Return ONLY a JSON array, no other text. Format:
[{"id": "article_id", "sentiment": "positive|neutral|negative", "score": 0.5, "severity": "routine"}, ...]

Articles:
${articleList}`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system:
        'You are a news sentiment analyzer. Analyze news articles and return balanced, nuanced sentiment scores. Positive news includes discoveries, solutions, progress, achievements. Negative news includes disasters, conflicts, failures, crises. Be calibrated - most news is neutral. Return only valid JSON arrays.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in sentiment response')
      return articles.map((a) => ({ id: a.id, sentiment: 'neutral', score: 0 }))
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id: string
      sentiment: string
      score: number
      severity?: string
    }>

    return parsed.map((item) => ({
      id: item.id,
      sentiment: (['positive', 'neutral', 'negative'].includes(item.sentiment)
        ? item.sentiment
        : 'neutral') as SentimentType,
      score: Math.max(-1, Math.min(1, item.score || 0)),
      severity: (['routine', 'notable', 'significant', 'major', 'critical'].includes(item.severity ?? '')
        ? item.severity
        : 'routine') as SeverityLevel,
    }))
  } catch (err) {
    console.error('Sentiment analysis error:', err)
    return articles.map((a) => ({ id: a.id, sentiment: 'neutral', score: 0, severity: 'routine' as SeverityLevel }))
  }
}

export async function generateTopStories(
  articles: Article[]
): Promise<Omit<TopStory, 'id' | 'createdAt'>[]> {
  const client = getClient()

  if (!client) {
    return []
  }

  // Take recent articles with good descriptions
  const recentArticles = articles
    .filter((a) => a.description || a.aiSummary)
    .slice(0, 100)

  if (recentArticles.length < 3) {
    return []
  }

  const articleList = recentArticles
    .map(
      (a, idx) =>
        `${idx + 1}. [${a.source}] [${a.category}] ${a.title}\n   ${a.description?.slice(0, 200) || ''}`
    )
    .join('\n')

  const prompt = `Based on these recent news articles, identify up to 20 top story clusters where multiple sources are covering similar topics. For each cluster, write a Perplexity-style aggregated summary.

Return ONLY a JSON array with this format (no other text):
[
  {
    "title": "Brief headline for the cluster (max 10 words)",
    "summary": "3-4 sentence balanced summary citing sources. Format: 'Reporting from [Source1], [Source2], and [Source3] indicates that...'",
    "category": "technology|science|business|world|positive",
    "articleIndices": [1, 3, 7],
    "sources": ["Source1", "Source2", "Source3"],
    "sentiment": "positive|neutral|negative"
  }
]

Articles:
${articleList}`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system:
        "You are a balanced news editor creating briefings. Synthesize news into clear, balanced summaries that inform without inducing anxiety. When reporting negative developments, include context, scale, and any positive aspects. Always end summaries constructively. Return only valid JSON.",
      messages: [{ role: 'user', content: prompt }],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in top stories response')
      return []
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      title: string
      summary: string
      category: string
      articleIndices: number[]
      sources: string[]
      sentiment: string
    }>

    return parsed.map((item) => {
      const relatedArticles = (item.articleIndices || [])
        .filter((idx) => idx >= 1 && idx <= recentArticles.length)
        .map((idx) => recentArticles[idx - 1])
        .filter(Boolean)

      return {
        title: item.title || 'Top Story',
        summary: item.summary || '',
        category: item.category || 'world',
        articleIds: relatedArticles.map((a) => a.id),
        sources: item.sources || relatedArticles.map((a) => a.source),
        sentiment: (['positive', 'neutral', 'negative'].includes(item.sentiment)
          ? item.sentiment
          : 'neutral') as SentimentType,
      }
    })
  } catch (err) {
    console.error('Top stories generation error:', err)
    return []
  }
}
