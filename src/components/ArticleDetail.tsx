'use client'

import { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Article, TopStory } from '@/types'
import SourceMark from './SourceMark'
import CategoryIcon, { CATEGORY_LABELS, SentimentDot } from './CategoryIcon'

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
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Dialog behaviour: Esc closes, focus moves into the sheet, page scroll locks,
  // focus returns to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !sheetRef.current) return
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    setBullets([])
    if (!article && !topStory) return

    if (topStory && topStory.bullets && topStory.bullets.length > 0) {
      setBullets(topStory.bullets)
      return
    }

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

  function parseSources(): string[] {
    if (!topStory) return []
    try {
      return typeof topStory.sources === 'string'
        ? (JSON.parse(topStory.sources) as string[])
        : topStory.sources
    } catch {
      return []
    }
  }

  function renderMeta() {
    if (article) {
      const timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
      return (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <SourceMark source={article.source} size="sm" newsletter={article.url.startsWith('newsletter://')} />
          <span className="font-semibold text-ink-soft">{article.source}</span>
          <span aria-hidden="true" className="text-ink-faint">·</span>
          <span>{timeAgo}</span>
        </div>
      )
    }
    if (topStory) {
      const timeAgo = formatDistanceToNow(new Date(topStory.createdAt), { addSuffix: true })
      const sources = parseSources()
      const categoryLabel = CATEGORY_LABELS[topStory.category]
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          {categoryLabel && (
            <span className="eyebrow flex items-center gap-1.5 text-accent-ink">
              <CategoryIcon category={topStory.category} />
              {categoryLabel}
            </span>
          )}
          {categoryLabel && <span aria-hidden="true" className="text-ink-faint">·</span>}
          <span className="tabular-nums">{sources.length} sources</span>
          <span aria-hidden="true" className="text-ink-faint">·</span>
          <span>{timeAgo}</span>
          <SentimentDot sentiment={topStory.sentiment} />
        </div>
      )
    }
    return null
  }

  const arrow = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  )

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-40 animate-fade-in bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet (centred column on wide screens) */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-detail-title"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] max-w-2xl animate-sheet-in overflow-y-auto overscroll-contain rounded-t-3xl border border-b-0 border-line bg-card shadow-lift"
      >
        {/* Handle + close */}
        <div className="sticky top-0 z-10 flex items-center justify-center bg-card/95 pb-2 pt-3 backdrop-blur">
          <div className="h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-well text-ink-soft transition-colors hover:bg-well-strong hover:text-ink"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-10 pt-2 sm:px-8">
          <div className="mb-3 pr-10">{renderMeta()}</div>

          <h2 id="article-detail-title" className="headline mb-3 text-[26px] font-semibold leading-[1.18]">
            {title}
          </h2>

          {article?.reason && (
            <p className="mb-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 flex-shrink-0 text-accent" aria-hidden="true"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" /></svg>
              <span>{article.reason}</span>
            </p>
          )}

          <div className="mb-5 border-t border-line" />

          {loading ? (
            <div className="mb-6 space-y-3" aria-hidden="true">
              <div className="h-4 w-full animate-pulse rounded bg-well" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-well" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-well" />
            </div>
          ) : bullets.length > 0 ? (
            <>
              <p className="eyebrow mb-3 text-ink-muted">Key points</p>
              <ol className="mb-7 space-y-3.5">
                {bullets.map((bullet, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                    <span className="mt-[3px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold tabular-nums text-accent-ink">
                      {i + 1}
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : description ? (
            <p className="mb-7 font-serif text-[17px] leading-relaxed text-ink-soft">{description}</p>
          ) : null}

          {topStory ? (
            topStoryArticles.length > 0 ? (
              <>
                <p className="eyebrow mb-2 text-ink-muted">Read the coverage</p>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                  {topStoryArticles.map((a) => (
                    <li key={a.url}>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-[52px] items-center gap-3 px-4 py-3 text-sm text-ink-soft transition-colors hover:bg-well/60 hover:text-ink"
                      >
                        <SourceMark source={a.source} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink">{a.source}</span>
                          {a.title && <span className="line-clamp-1 text-xs text-ink-muted">{a.title}</span>}
                        </span>
                        <span className="text-ink-muted">{arrow}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-center text-sm text-ink-muted">No source articles available</p>
            )
          ) : article ? (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-ink/85"
            >
              Read full article at {article.source}
              {arrow}
            </a>
          ) : null}
        </div>
      </div>
    </>
  )
}
