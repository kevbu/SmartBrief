import Parser from 'rss-parser'
import type { RawArticle, CategoryType } from '@/types'
import { NEWS_SOURCES } from './news-sources'

const parser = new Parser({
  timeout: 10000,
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

async function fetchSourceFeed(
  source: (typeof NEWS_SOURCES)[0]
): Promise<RawArticle[]> {
  const feed = await parser.parseURL(source.url)
  const items = feed.items.slice(0, 10)

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
      }
    })
}

export async function fetchAllFeeds(enabledSourceIds?: string[]): Promise<RawArticle[]> {
  const sources =
    enabledSourceIds && enabledSourceIds.length > 0
      ? NEWS_SOURCES.filter((s) => enabledSourceIds.includes(s.id))
      : NEWS_SOURCES

  const results = await Promise.allSettled(
    sources.map((source) => fetchSourceFeed(source))
  )

  const articles: RawArticle[] = []

  const usedSources = enabledSourceIds && enabledSourceIds.length > 0
    ? NEWS_SOURCES.filter((s) => enabledSourceIds.includes(s.id))
    : NEWS_SOURCES

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    } else {
      console.error(
        `Failed to fetch ${usedSources[index].name}: ${result.reason}`
      )
    }
  })

  return articles
}
