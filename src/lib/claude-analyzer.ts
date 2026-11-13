import Anthropic from '@anthropic-ai/sdk'
import type { Article, SentimentResult, SentimentType, TopStory } from '@/types'
import { NEWS_SOURCES } from './news-sources'

const sourceLangMap: Record<string, string> = Object.fromEntries(
  NEWS_SOURCES.map((s) => [s.name, s.language])
)

export type SeverityLevel = 'routine' | 'notable' | 'significant' | 'major' | 'critical'

export interface SeverityResult {
  id: string
  severity: SeverityLevel
}

export interface CompletionRequest {
  model: string
  maxTokens: number
  system?: string
  prompt: string
  /** JSON schema for one array item. Local mode enforces it via structured output. */
  itemSchema?: Record<string, unknown>
}

export type Completer = (req: CompletionRequest) => Promise<string>

function useLocalSdk(): boolean {
  return process.env.CLAUDE_USE_LOCAL_SDK === 'true'
}

const LOCAL_SDK_TIMEOUT_MS = 5 * 60 * 1000

// Local mode: route calls through the Claude Agent SDK, which uses the
// machine's logged-in Claude Code CLI instead of an API key.
async function completeWithLocalSdk(req: CompletionRequest): Promise<string> {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const started = Date.now()
  // Without a timeout a stalled CLI process blocks the whole refresh.
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), LOCAL_SDK_TIMEOUT_MS)
  let result = ''
  try {
    for await (const message of query({
      prompt: req.prompt,
      options: {
        abortController,
        env: {
          ...(process.env as Record<string, string>),
          CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(req.maxTokens),
          CLAUDE_AGENT_SDK_CLIENT_APP: 'smartbrief',
        },
        model: req.model,
        systemPrompt: req.system,
        // Claude Code enables extended thinking by default. These are single-shot
        // classification/summarization calls, so thinking only adds latency.
        thinking: { type: 'disabled' },
        tools: [],
        settingSources: [],
        // Structured output may need a retry turn if validation fails.
        maxTurns: req.itemSchema ? 3 : 1,
        persistSession: false,
        // Structured output guarantees valid JSON (free-text JSON broke on
        // unescaped quotes in German summaries).
        outputFormat: req.itemSchema
          ? {
              type: 'json_schema',
              schema: {
                type: 'object',
                properties: { items: { type: 'array', items: req.itemSchema } },
                required: ['items'],
              },
            }
          : undefined,
      },
    })) {
      if (message.type === 'result') {
        if (message.subtype !== 'success') {
          throw new Error(`Claude Agent SDK error: ${message.subtype}`)
        }
        const structured = message.structured_output as { items?: unknown[] } | undefined
        result = structured?.items ? JSON.stringify(structured.items) : message.result
        console.log(
          `[claude-local] ${req.model}: ${((Date.now() - started) / 1000).toFixed(1)}s, ${message.usage.output_tokens} output tokens`
        )
      }
    }
  } finally {
    clearTimeout(timeout)
  }
  return result
}

export function isAiAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || useLocalSdk()
}

export function getClient(): Completer | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey && !useLocalSdk()) {
    const anthropic = new Anthropic({ apiKey })
    return async (req) => {
      const response = await anthropic.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
      })
      const block = response.content[0]
      return block?.type === 'text' ? block.text : ''
    }
  }
  if (useLocalSdk()) return completeWithLocalSdk
  return null
}

const SENTIMENT_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    score: { type: 'number' },
    severity: { type: 'string', enum: ['routine', 'notable', 'significant', 'major', 'critical'] },
  },
  required: ['id', 'sentiment', 'score', 'severity'],
}

const TOP_STORY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    category: { type: 'string' },
    articleIndices: { type: 'array', items: { type: 'integer' } },
    sources: { type: 'array', items: { type: 'string' } },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
  },
  required: ['title', 'summary', 'bullets', 'category', 'articleIndices', 'sources', 'sentiment'],
}

export async function analyzeSentiment(
  articles: Pick<Article, 'id' | 'title' | 'description'>[]
): Promise<SentimentResult[]> {
  const client = getClient()

  if (!client) {
    // Graceful degradation: no results, articles keep their neutral default
    return []
  }

  // Build all batches and run them concurrently
  const batches: Promise<SentimentResult[]>[] = []
  for (let i = 0; i < articles.length; i += 20) {
    batches.push(analyzeBatch(client, articles.slice(i, i + 20)))
  }
  const batchResults = await Promise.all(batches)
  return batchResults.flat()
}

async function analyzeBatch(
  client: Completer,
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
    const text = await client({
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 2048,
      itemSchema: SENTIMENT_ITEM_SCHEMA,
      system:
        'You are a news sentiment analyzer. Analyze news articles and return balanced, nuanced sentiment scores. Positive news includes discoveries, solutions, progress, achievements. Negative news includes disasters, conflicts, failures, crises. Be calibrated - most news is neutral. Return only valid JSON arrays.',
      prompt,
    })

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in sentiment response')
      return []
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
    return []
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
    .map((a, idx) => {
      const lang = sourceLangMap[a.source] ?? 'en'
      return `${idx + 1}. [${a.source}] [${lang}] [${a.category}] ${a.title}\n   ${a.description?.slice(0, 200) || ''}`
    })
    .join('\n')

  const prompt = `Based on these recent news articles, identify up to 20 top story clusters where multiple sources are covering similar topics. For each cluster, write a brief summary and 2-5 bullet points.

Return ONLY a JSON array with this format (no other text):
[
  {
    "title": "Brief headline for the cluster (max 10 words)",
    "summary": "2-3 sentence balanced summary citing sources. Format: 'Reporting from [Source1], [Source2], and [Source3] indicates that...'",
    "bullets": ["Concrete fact from the cluster, max 15 words", "Another key development", "Third fact if relevant"],
    "category": "technology|science|business|world|positive",
    "articleIndices": [1, 3, 7],
    "sources": ["Source1", "Source2", "Source3"],
    "sentiment": "positive|neutral|negative"
  }
]

Each bullet must be a concrete, specific fact (not a vague summary). Max 5 bullets per cluster.

Language rule: Each article is tagged [de] or [en]. For each cluster, count the [de] and [en] tags among its articleIndices. If [de] articles outnumber [en] articles, write that cluster's title, summary, and bullets entirely in German. Otherwise write in English.

Articles:
${articleList}`

  try {
    const text = await client({
      model: 'claude-sonnet-4-6',
      maxTokens: 8000,
      itemSchema: TOP_STORY_ITEM_SCHEMA,
      system:
        "You are a balanced news editor creating briefings. Synthesize news into clear, balanced summaries that inform without inducing anxiety. When reporting negative developments, include context, scale, and any positive aspects. Always end summaries constructively. Return only valid JSON.",
      prompt,
    })

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in top stories response')
      return []
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      title: string
      summary: string
      bullets?: string[]
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
        bullets: (item.bullets ?? []).filter(Boolean).slice(0, 5),
        clusterArticles: relatedArticles.map((a) => ({ title: a.title, source: a.source, url: a.url })),
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
