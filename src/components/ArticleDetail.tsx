'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Article, TopStory } from '@/types'
import { getEmojiForSource } from '@/lib/news-sources'

interface ArticleDetailProps {
  article: Article | null
  topStory: TopStory | null
  allArticles: Article[]
  onClose: () => void
}

interface ArticleWithBullets extends Article {
  bullets?: string[]
}

export default function ArticleDetail({
  article,
  topStory,
  allArticles,
  onClose,
}: ArticleDetailProps) {
  const [bullets, setBullets] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setBullets([])
    if (!article && !topStory) return

    async function fetchBullets() {
      setLoading(true)
      try {
        if (article) {
          const res = await fetch(`/api/articles/${article.id}`)
          if (res.ok) {
            const data = await res.json() as ArticleWithBullets
            setBullets(data.bullets ?? [])
          }
        } else if (topStory) {
          // For top stories, fetch bullets for the first article
          let ids: string[] = []
          try {
            ids = typeof topStory.articleIds === 'string'
              ? (JSON.parse(topStory.articleIds) as string[])
              : topStory.articleIds
          } catch {
            ids = []
          }
          if (ids.length > 0) {
            const res = await fetch(`/api/articles/${ids[0]}?topStoryId=${topStory.id}`)
            if (res.ok) {
              const data = await res.json() as ArticleWithBullets
              setBullets(data.bullets ?? [])
            }
          }
        }
      } catch (err) {
        console.error('Error fetching article detail:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchBullets()
  }, [article, topStory])

  // Resolve topStory articleIds to actual Article objects
  function getTopStoryArticles(): Article[] {
    if (!topStory) return []
    let ids: string[] = []
    try {
      ids = typeof topStory.articleIds === 'string'
        ? (JSON.parse(topStory.articleIds) as string[])
        : topStory.articleIds
    } catch {
      ids = []
    }
    return ids
      .map((id) => allArticles.find((a) => a.id === id))
      .filter((a): a is Article => a !== undefined)
  }

  const topStoryArticles = getTopStoryArticles()

  const title = article?.title ?? topStory?.title ?? ''
  const description = article?.description ?? topStory?.summary ?? ''

  // Sources and time
  function renderSourceRow() {
    if (article) {
      const timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span>{getEmojiForSource(article.source)}</span>
          <span className="font-medium text-gray-500">{article.source}</span>
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      )
    }
    if (topStory) {
      const timeAgo = formatDistanceToNow(new Date(topStory.createdAt), { addSuffix: true })
      let sources: string[] = []
      try {
        sources = typeof topStory.sources === 'string'
          ? (JSON.parse(topStory.sources) as string[])
          : topStory.sources
      } catch {
        sources = []
      }
      return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">Top Story</span>
          {sources.slice(0, 3).map((s) => (
            <span key={s} className="flex items-center gap-0.5">
              <span>{getEmojiForSource(s)}</span>
              <span className="font-medium text-gray-500">{s}</span>
            </span>
          ))}
          {sources.length > 3 && (
            <span>+{sources.length - 3} more</span>
          )}
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      )
    }
    return null
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Source row */}
          <div className="mb-3">
            {renderSourceRow()}
          </div>

          {/* Headline */}
          <h2 className="mb-3 text-xl font-bold leading-snug text-gray-900">
            {title}
          </h2>

          {/* Why am I seeing this? */}
          {article?.reason ? (
            <p className="mb-3 flex items-center gap-1 text-[11px] text-gray-400">
              <span>✦</span>
              <span>{article.reason}</span>
            </p>
          ) : null}

          {/* Divider */}
          <div className="mb-4 border-t border-gray-100" />

          {/* Bullets or skeleton */}
          {loading ? (
            <div className="mb-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100" />
            </div>
          ) : bullets.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-700">
                  <span className="mt-0.5 flex-shrink-0 text-gray-400">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : description ? (
            <p className="mb-4 text-sm leading-relaxed text-gray-600">{description}</p>
          ) : null}

          {/* Read full article button(s) */}
          <div className="space-y-2">
            {topStory ? (
              topStoryArticles.length > 0 ? (
                topStoryArticles.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2">
                      <span>{getEmojiForSource(a.source)}</span>
                      <span>Read at {a.source}</span>
                    </span>
                    <span className="text-gray-400">→</span>
                  </a>
                ))
              ) : (
                <p className="text-center text-sm text-gray-400">No source articles available</p>
              )
            ) : article ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Read full article →
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
