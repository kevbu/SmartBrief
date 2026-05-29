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

  function getTopStoryArticles(): Array<{ title?: string; source: string; url: string }> {
    if (!topStory) return []
    if (topStory.clusterArticles && topStory.clusterArticles.length > 0) {
      return topStory.clusterArticles
    }
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

  function renderSourceRow() {
    if (article) {
      const timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
      return (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span>{getEmojiForSource(article.source)}</span>
          <span className="font-medium text-slate-600 dark:text-slate-400">{article.source}</span>
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
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">Top Story</span>
          {sources.slice(0, 3).map((s) => (
            <span key={s} className="flex items-center gap-0.5">
              <span>{getEmojiForSource(s)}</span>
              <span className="font-medium text-slate-600 dark:text-slate-400">{s}</span>
            </span>
          ))}
          {sources.length > 3 && <span>+{sources.length - 3} more</span>}
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      )
    }
    return null
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Drag handle */}
        <div className="sticky top-0 flex justify-center bg-white pt-3 pb-2 dark:bg-slate-900">
          <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="px-5 pb-10 pt-1">
          {/* Source row */}
          <div className="mb-3">{renderSourceRow()}</div>

          {/* Headline */}
          <h2 className="mb-3 text-xl font-bold leading-snug text-slate-900 dark:text-slate-100">
            {title}
          </h2>

          {/* Why am I seeing this? */}
          {article?.reason && (
            <p className="mb-3 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              <span>✦</span>
              <span>{article.reason}</span>
            </p>
          )}

          {/* Divider */}
          <div className="mb-4 border-t border-slate-100 dark:border-slate-800" />

          {/* Bullets or skeleton */}
          {loading ? (
            <div className="mb-4 space-y-2.5">
              <div className="h-4 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-5/6 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-4/5 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : bullets.length > 0 ? (
            <ul className="mb-5 space-y-2.5">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : description ? (
            <p className="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
          ) : null}

          {/* Read full article button(s) */}
          <div className="space-y-2">
            {topStory ? (
              topStoryArticles.length > 0 ? (
                topStoryArticles.map((a) => (
                  <a
                    key={a.url}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <span>{getEmojiForSource(a.source)}</span>
                      <span>Read at {a.source}</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-400">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                ))
              ) : (
                <p className="text-center text-sm text-slate-400 dark:text-slate-500">No source articles available</p>
              )
            ) : article ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
              >
                Read full article
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
