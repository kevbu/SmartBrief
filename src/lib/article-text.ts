// Pure helpers for article full text: JSON-LD extraction from article pages
// and picking the best text to send to Claude. No I/O here.

const LD_JSON_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function collectNodes(value: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const v of value) collectNodes(v, out)
    return
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    out.push(obj)
    if (obj['@graph']) collectNodes(obj['@graph'], out)
  }
}

/**
 * Returns the longest `articleBody` found in the page's JSON-LD blocks, or
 * null if there is none. Publishers with a server-side paywall (Handelsblatt
 * H+) put only the free part here unless the request is logged in.
 */
export function extractArticleBody(html: string): string | null {
  let best: string | null = null
  for (const match of html.matchAll(LD_JSON_RE)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1])
    } catch {
      continue
    }
    const nodes: Record<string, unknown>[] = []
    collectNodes(parsed, nodes)
    for (const node of nodes) {
      const body = node.articleBody
      if (typeof body !== 'string') continue
      const text = cleanText(body)
      if (text && (!best || text.length > best.length)) best = text
    }
  }
  return best
}

/**
 * Text to send to Claude for one article: the stored content if it adds
 * something beyond the description, else the description. Capped at `max`
 * characters to bound token cost.
 */
export function pickArticleText(
  article: { description: string | null; content: string | null },
  max: number
): string {
  const description = article.description?.trim() ?? ''
  const content = article.content?.trim() ?? ''
  const text = content.length > description.length + 50 ? content : description || content
  return text.length > max ? `${text.slice(0, max).trimEnd()} …` : text
}
