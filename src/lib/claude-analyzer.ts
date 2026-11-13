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
  /** JSON schema for a single object response. Same enforcement as itemSchema. */
  objectSchema?: Record<string, unknown>
  /** Abort the call after this many ms (default 5 min). */
  timeoutMs?: number
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
  const timeout = setTimeout(() => abortController.abort(), req.timeoutMs ?? LOCAL_SDK_TIMEOUT_MS)
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
        // Structured output takes 2 turns (tool call + finish), plus retries
        // when validation fails.
        maxTurns: req.itemSchema || req.objectSchema ? 5 : 1,
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
          : req.objectSchema
            ? { type: 'json_schema', schema: req.objectSchema }
            : undefined,
      },
    })) {
      if (message.type === 'result') {
        if (message.subtype !== 'success') {
          throw new Error(`Claude Agent SDK error: ${message.subtype}`)
        }
        const structured = message.structured_output as { items?: unknown[] } | undefined
        if (structured && req.itemSchema) result = JSON.stringify(structured.items ?? [])
        else if (structured && req.objectSchema) result = JSON.stringify(structured)
        else result = message.result
        console.log(
          `[claude-local] ${req.model}: ${((Date.now() - started) / 1000).toFixed(1)}s, ${message.usage.output_tokens} output tokens, ${message.num_turns} turns`
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
      }, req.timeoutMs ? { timeout: req.timeoutMs } : undefined)
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

const CLUSTER_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    articleIndices: { type: 'array', items: { type: 'integer' } },
    category: { type: 'string', enum: ['technology', 'science', 'business', 'world', 'positive'] },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
  },
  required: ['articleIndices', 'category', 'sentiment'],
}

const STORY_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'bullets'],
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
        `${idx + 1}. ID: ${a.id}\nTitle: ${a.title}\nDescription: ${a.description?.slice(0, 500) || 'No description'}`
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

    // Drop IDs the model mangled or invented; one unknown ID would otherwise
    // fail the whole DB transaction. Missing articles retry next refresh.
    const batchIds = new Set(articles.map((a) => a.id))
    return parsed.filter((item) => batchIds.has(item.id)).map((item) => ({
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

const SUMMARY_CONCURRENCY = 10

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++
      results[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return results
}

function extractJson(text: string, kind: 'array' | 'object'): unknown {
  const match = text.match(kind === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON ${kind} found in response`)
  return JSON.parse(match[0])
}

interface Cluster {
  articleIndices: number[]
  category: string
  sentiment: string
}

// Top stories run in two phases. Phase 1 only groups articles into clusters,
// which needs the global view but little output. Phase 2 writes title, summary
// and bullets per cluster in parallel. Output generation is the bottleneck, so
// splitting it cuts the wall-clock time from ~2 min to a fraction of that.
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

  // Phase 1: clustering
  let clusters: Cluster[]
  try {
    const text = await client({
      model: 'claude-sonnet-4-6',
      maxTokens: 2000,
      itemSchema: CLUSTER_ITEM_SCHEMA,
      system: 'You are a news editor grouping articles into story clusters. Return only valid JSON.',
      prompt: `Based on these recent news articles, identify up to 20 top story clusters where multiple sources are covering the same story. Order clusters by importance.

Rules:
- One cluster per story. Articles in different languages (German and English) about the same story belong to the SAME cluster.
- Each article index may appear in at most one cluster.
- Before answering, check that no two clusters cover the same story; merge them if they do.

Return ONLY a JSON array with this format (no other text):
[{"articleIndices": [1, 3, 7], "category": "technology|science|business|world|positive", "sentiment": "positive|neutral|negative"}]

Articles:
${articleList}`,
    })
    // Enforce "each article in at most one cluster" in code as well
    const usedIndices = new Set<number>()
    clusters = (extractJson(text, 'array') as Cluster[])
      .map((c) => ({
        ...c,
        articleIndices: (Array.isArray(c.articleIndices) ? c.articleIndices : []).filter((idx) => {
          if (usedIndices.has(idx)) return false
          usedIndices.add(idx)
          return true
        }),
      }))
      .filter((c) => c.articleIndices.length > 0)
  } catch (err) {
    console.error('Top stories clustering error:', err)
    return []
  }

  // Phase 2: one summary call per cluster, in parallel
  const stories = await mapWithConcurrency(clusters, SUMMARY_CONCURRENCY, async (cluster) => {
    const relatedArticles = cluster.articleIndices
      .filter((idx) => idx >= 1 && idx <= recentArticles.length)
      .map((idx) => recentArticles[idx - 1])
      .filter(Boolean)
    if (relatedArticles.length === 0) return null

    // Language rule: German if German sources outnumber English ones
    const deCount = relatedArticles.filter((a) => (sourceLangMap[a.source] ?? 'en') === 'de').length
    const language = deCount > relatedArticles.length - deCount ? 'German' : 'English'
    const sources = Array.from(new Set(relatedArticles.map((a) => a.source)))

    const clusterList = relatedArticles
      .map((a) => `- [${a.source}] ${a.title}\n  ${a.description?.slice(0, 400) || ''}`)
      .join('\n')

    try {
      const text = await client({
        model: 'claude-sonnet-4-6',
        maxTokens: 1500,
        objectSchema: STORY_SUMMARY_SCHEMA,
        // One slow cluster must not hold up the whole refresh; drop it instead.
        timeoutMs: 45_000,
        system:
          'You are a balanced news editor creating briefings. Synthesize news into clear, balanced summaries that inform without inducing anxiety. When reporting negative developments, include context, scale, and any positive aspects. Always end summaries constructively. Return only valid JSON.',
        prompt: `These articles from different sources cover the same story. Write a briefing for it.

Return ONLY a JSON object with this format (no other text):
{
  "title": "Brief headline for the story (max 10 words)",
  "summary": "2-3 sentence balanced summary citing sources. Format: 'Reporting from [Source1], [Source2], and [Source3] indicates that...'",
  "bullets": ["Concrete fact from the cluster, max 15 words", "Another key development", "Third fact if relevant"]
}

Each bullet must be a concrete, specific fact (not a vague summary). 2-5 bullets.
Write the title, summary, and bullets entirely in ${language}.

Articles:
${clusterList}`,
      })
      const item = extractJson(text, 'object') as { title?: string; summary?: string; bullets?: string[] }
      return {
        title: item.title || 'Top Story',
        summary: item.summary || '',
        bullets: (item.bullets ?? []).filter(Boolean).slice(0, 5),
        clusterArticles: relatedArticles.map((a) => ({ title: a.title, source: a.source, url: a.url })),
        category: cluster.category || 'world',
        articleIds: relatedArticles.map((a) => a.id),
        sources,
        sentiment: (['positive', 'neutral', 'negative'].includes(cluster.sentiment)
          ? cluster.sentiment
          : 'neutral') as SentimentType,
      }
    } catch (err) {
      console.error('Top story summary error:', err)
      return null
    }
  })

  return stories.filter((s): s is NonNullable<typeof s> => s !== null)
}
