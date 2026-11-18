import Parser from 'rss-parser'
import type { RawArticle, CategoryType } from '@/types'
import { NEWS_SOURCES } from './news-sources'

interface FetchableSource {
  id: string
  name: string
  url: string
  category: string
  extraUrls?: string[]
  maxItems?: number
}

const DEFAULT_MAX_ITEMS = 10

const parser = new Parser({
  timeout: 5000,
  headers: {
    'User-Agent': 'SmartBrief/1.0 RSS Reader',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
      ['media:category', 'mediaCategories', { keepArray: true }],
    ],
  },
})

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractImageUrl(item: Record<string, unknown>): string | null {
  const mediaContent = item.mediaContent as Record<string, unknown> | undefined
  if (mediaContent && typeof mediaContent === 'object') {
    const attrs = mediaContent as { $?: { url?: string }; url?: string }
    if (attrs.$?.url) return attrs.$?.url ?? null
    if (attrs.url) return attrs.url ?? null
  }

  const mediaThumbnail = item.mediaThumbnail as Record<string, unknown> | undefined
  if (mediaThumbnail && typeof mediaThumbnail === 'object') {
    const attrs = mediaThumbnail as { $?: { url?: string }; url?: string }
    if (attrs.$?.url) return attrs.$?.url ?? null
    if (attrs.url) return attrs.url ?? null
  }

  const enclosure = item.enclosure as Record<string, unknown> | undefined
  if (enclosure && typeof enclosure === 'object') {
    const enc = enclosure as { type?: string; url?: string }
    if (enc.type?.startsWith('image/') && enc.url) return enc.url
  }

  // Try to find image in content
  const content = (item.contentEncoded as string) || (item.content as string) || ''
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch) return imgMatch[1]

  return null
}

/**
 * True if the item carries a paid-access marker. Handelsblatt tags H+ items
 * with <media:category label="accessCategory">H_PLUS</media:category>.
 */
export function isPremiumItem(item: Record<string, unknown>): boolean {
  const cats = item.mediaCategories
  if (!Array.isArray(cats)) return false
  return cats.some((c) => {
    if (!c || typeof c !== 'object') return false
    const cat = c as { _?: string; $?: { label?: string } }
    return cat.$?.label === 'accessCategory' && cat._?.trim() === 'H_PLUS'
  })
}

async function fetchSourceFeed(source: FetchableSource): Promise<RawArticle[]> {
  const urls = [source.url, ...(source.extraUrls ?? [])]
  const results = await Promise.allSettled(urls.map((url) => fetchFeedUrl(source, url)))
  const articles: RawArticle[] = []
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') articles.push(...result.value)
    else if (idx > 0) console.error(`Failed to fetch ${source.name} (${urls[idx]}): ${result.reason}`)
  })
  // The main feed is the source's health signal; extra section feeds are best effort.
  if (results[0].status === 'rejected') throw results[0].reason
  return articles
}

async function fetchFeedUrl(source: FetchableSource, url: string): Promise<RawArticle[]> {
  const feed = await parser.parseURL(url)
  const items = feed.items.slice(0, source.maxItems ?? DEFAULT_MAX_ITEMS)

  return items
    .filter((item) => item.link && item.title)
    .map((item) => {
      const rawItem = item as unknown as Record<string, unknown>
      return {
        title: stripHtml(item.title) || 'Untitled',
        description: stripHtml(item.contentSnippet || item.summary || (rawItem.description as string) || null),
        content: stripHtml((rawItem.contentEncoded as string) || item.content || null),
        url: item.link!,
        imageUrl: extractImageUrl(rawItem),
        publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        source: source.name,
        sourceUrl: feed.link || source.url,
        category: source.category as CategoryType,
        isPremium: isPremiumItem(rawItem),
      }
    })
}

export async function fetchAllFeeds(
  enabledSourceIds?: string[],
  customSources?: FetchableSource[]
): Promise<RawArticle[]> {
  const builtinSources: FetchableSource[] =
    enabledSourceIds && enabledSourceIds.length > 0
      ? NEWS_SOURCES.filter((s) => enabledSourceIds.includes(s.id))
      : NEWS_SOURCES

  const allSources: FetchableSource[] = [
    ...builtinSources,
    ...(customSources ?? []),
  ]

  const results = await Promise.allSettled(
    allSources.map((source) => fetchSourceFeed(source))
  )

  const articles: RawArticle[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    } else {
      console.error(
        `Failed to fetch ${allSources[index].name}: ${result.reason}`
      )
    }
  })

  return articles
}
