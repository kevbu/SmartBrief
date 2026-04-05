/**
 * Newsletter parser — converts an inbound email into an Article-ready object.
 *
 * Design decisions:
 * - One newsletter email = one article. We don't try to split newsletters into
 *   sub-articles because newsletter formats vary wildly and partial extraction
 *   is worse than a clean full-content article.
 * - Category is guessed from subject/sender keywords; falls back to 'world'.
 * - Sentiment defaults to 'neutral' (score 0) so it gets picked up by the
 *   normal sentiment analysis batch on the next /api/news/refresh call.
 * - No external dependencies — plain string operations only.
 */

import type { CategoryType } from '@/types'

export interface ParsedNewsletter {
  title: string
  description: string
  content: string
  url: string
  source: string
  sourceUrl: string | null
  publishedAt: Date
  category: CategoryType
}

/** Strip HTML tags and collapse whitespace, preserving paragraph breaks. */
function htmlToText(html: string): string {
  return html
    // Replace block-level elements with double newline
    .replace(/<\/(p|div|li|blockquote|h[1-6]|tr)>/gi, '\n\n')
    // Replace <br> with newline
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    // Collapse excessive whitespace while keeping paragraph breaks
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Guess a SmartBrief category from subject and sender keywords. */
function guessCategory(subject: string, from: string): CategoryType {
  const text = `${subject} ${from}`.toLowerCase()

  if (/tech|ai|software|developer|startup|silicon|crypto|digital/.test(text)) return 'technology'
  if (/health|science|medical|climate|space|research|study/.test(text)) return 'science'
  if (/business|finance|market|economy|invest|stock|money/.test(text)) return 'business'
  if (/good news|uplifting|positive|joy|hopeful|bright|inspire/.test(text)) return 'positive'
  return 'world'
}

/** Extract a plain-text excerpt (≤280 chars) for the description field. */
function excerpt(text: string, maxLen = 280): string {
  if (text.length <= maxLen) return text
  const cut = text.lastIndexOf(' ', maxLen)
  return cut > 0 ? text.slice(0, cut) + '…' : text.slice(0, maxLen) + '…'
}

/**
 * Derive a stable pseudo-URL for the article. We can't link to the original
 * email, so we construct a namespaced URL that is unique per sender + subject.
 */
function buildPseudoUrl(from: string, subject: string, receivedAt: Date): string {
  const ts = receivedAt.getTime()
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  // Use a internal namespace that can never clash with a real URL
  return `newsletter://${encodeURIComponent(from)}/${slug}-${ts}`
}

export function parseNewsletterEmail(opts: {
  from: string
  subject: string
  html?: string
  text?: string
  receivedAt?: Date
}): ParsedNewsletter {
  const { from, subject, html, text, receivedAt = new Date() } = opts

  // Prefer HTML for content extraction; fall back to plain text
  const rawContent = html ? htmlToText(html) : (text ?? '')
  const content = rawContent.slice(0, 8000) // cap at 8 KB to stay within token budget

  // Derive display source name from the From field, e.g. "The Hustle <newsletter@hustle.com>"
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
  const sourceName = nameMatch ? nameMatch[1].trim() : from.replace(/<[^>]+>/, '').trim()

  // Sender domain as sourceUrl, e.g. https://hustle.com
  const emailMatch = from.match(/<([^>]+)>/) ?? from.match(/(\S+@\S+)/)
  const emailAddr = emailMatch ? emailMatch[1] : null
  const domain = emailAddr ? emailAddr.split('@')[1] : null
  const sourceUrl = domain ? `https://${domain}` : null

  return {
    title: subject,
    description: excerpt(content),
    content,
    url: buildPseudoUrl(from, subject, receivedAt),
    source: sourceName || 'Newsletter',
    sourceUrl,
    publishedAt: receivedAt,
    category: guessCategory(subject, from),
  }
}
