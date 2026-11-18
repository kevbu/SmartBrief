import { NEWS_SOURCES } from './news-sources'
import { extractArticleBody } from './article-text'

/** Max article pages fetched per refresh, so a first run stays polite. */
export const ENRICH_MAX_PER_REFRESH = 40
const ENRICH_CONCURRENCY = 2
const ENRICH_TIMEOUT_MS = 8000
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

interface Enrichable {
  url: string
  source: string
  description: string | null
  content: string | null
}

const fullTextSources = new Set(NEWS_SOURCES.filter((s) => s.fullText).map((s) => s.name))

export function wantsFullText(article: Pick<Enrichable, 'source' | 'url'>): boolean {
  return fullTextSources.has(article.source) && /^https?:\/\//.test(article.url)
}

async function fetchArticleBody(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(ENRICH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return extractArticleBody(await res.text())
}

/**
 * Fetches the article page for sources marked `fullText` and stores the
 * JSON-LD article body in `content` when it is longer than what the feed gave.
 * Mutates the given items. Failures are logged and leave the item unchanged.
 */
export async function enrichWithFullText<T extends Enrichable>(articles: T[]): Promise<number> {
  const targets = articles.filter(wantsFullText).slice(0, ENRICH_MAX_PER_REFRESH)
  if (targets.length === 0) return 0

  let enriched = 0
  let failed = 0
  let next = 0
  const worker = async () => {
    while (next < targets.length) {
      const article = targets[next++]
      try {
        const body = await fetchArticleBody(article.url)
        const current = Math.max(article.content?.length ?? 0, article.description?.length ?? 0)
        if (body && body.length > current) {
          article.content = body
          enriched++
        }
      } catch (e) {
        failed++
        console.warn(`[enrich] ${article.source}: ${article.url} failed: ${(e as Error).message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ENRICH_CONCURRENCY, targets.length) }, worker))
  console.log(`[enrich] full text for ${enriched}/${targets.length} articles` + (failed ? `, ${failed} failed` : ''))
  return enriched
}
