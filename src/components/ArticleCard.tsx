'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import type { Article, DepthMode, FeedbackType } from '@/types'
import SentimentBadge from './SentimentBadge'
import BiasBadge from './BiasBadge'
import FeedbackMenu from './FeedbackMenu'
import { getEmojiForSource } from '@/lib/news-sources'

const SKIP_VISIBILITY_MS = 3000 // 3s visible without interaction = skip signal

interface ArticleCardProps {
  article: Article
  depthMode?: DepthMode
  onMarkRead: (id: string) => void
  onToggleSave: (id: string) => void
  onFeedback?: (id: string, feedback: FeedbackType) => void
  onSkip?: (id: string) => void
  onSelect?: (article: Article) => void
  showFeedbackTooltip?: boolean
  onFeedbackTooltipDismissed?: () => void
}

export default function ArticleCard({
  article,
  depthMode = 'skim',
  onMarkRead,
  onToggleSave,
  onFeedback,
  onSkip,
  onSelect,
  showFeedbackTooltip = false,
  onFeedbackTooltipDismissed,
}: ArticleCardProps) {
  const [isSaved, setIsSaved] = useState(article.isSaved)
  const [isRead, setIsRead] = useState(article.isRead)
  const [hidden, setHidden] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Skip signal: fire onSkip if article is visible >3s without being interacted with
  const cardRef = useRef<HTMLElement>(null)
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interactedRef = useRef(article.isRead) // pre-read articles don't need skip

  useEffect(() => {
    if (!onSkip || interactedRef.current) return

    const el = cardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          skipTimerRef.current = setTimeout(() => {
            if (!interactedRef.current) {
              onSkip(article.id)
              interactedRef.current = true // only fire once per card
            }
          }, SKIP_VISIBILITY_MS)
        } else {
          if (skipTimerRef.current !== null) {
            clearTimeout(skipTimerRef.current)
            skipTimerRef.current = null
          }
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (skipTimerRef.current !== null) clearTimeout(skipTimerRef.current)
    }
  // article.id and onSkip are stable across card's lifetime — safe deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id])

  function handleClick() {
    // Cancel skip timer — user interacted with this card
    interactedRef.current = true
    if (skipTimerRef.current !== null) {
      clearTimeout(skipTimerRef.current)
      skipTimerRef.current = null
    }

    if (collapsed) {
      setCollapsed(false)
      return
    }
    if (!isRead) {
      setIsRead(true)
      onMarkRead(article.id)
    }
    if (onSelect) {
      onSelect(article)
    } else {
      window.open(article.url, '_blank', 'noopener,noreferrer')
    }
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    setIsSaved(!isSaved)
    onToggleSave(article.id)
  }

  function handleFeedback(feedback: FeedbackType) {
    onFeedback?.(article.id, feedback)
    if (feedback === 'hide-source') {
      setHidden(true)
    } else if (feedback === 'off-topic') {
      setCollapsed(true)
    }
  }

  if (hidden) return null

  // Off-topic collapse: show a single stub row the user can tap to re-expand
  if (collapsed) {
    return (
      <article
        className="mx-4 mb-1 flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 shadow-sm opacity-50 transition-all active:scale-[0.99]"
        onClick={handleClick}
        aria-label="Off-topic story — tap to expand"
      >
        <span className="text-xs text-gray-400">🚫</span>
        <p className="min-w-0 flex-1 truncate text-xs text-gray-400">{article.title}</p>
        <span className="flex-shrink-0 text-[10px] text-gray-300">tap to expand</span>
      </article>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(article.publishedAt), {
    addSuffix: true,
  })

  // Depth mode: skim = 1-line description, deep = full AI summary
  const displayText = depthMode === 'deep'
    ? (article.aiSummary || article.description)
    : article.description

  const textClamp = depthMode === 'deep' ? 'line-clamp-4' : 'line-clamp-2'

  return (
    <article
      ref={cardRef}
      className={clsx(
        'mx-4 mb-3 cursor-pointer rounded-xl bg-white p-4 shadow-sm transition-all active:scale-[0.99]',
        isRead && 'opacity-60'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Source row */}
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-400">
            <span>{article.url.startsWith('newsletter://') ? '✉️' : getEmojiForSource(article.source)}</span>
            <span className="font-medium text-gray-500">{article.source}</span>
            {article.url.startsWith('newsletter://') && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
                newsletter
              </span>
            )}
            <BiasBadge source={article.source} />
            <span>·</span>
            <span>{timeAgo}</span>
          </div>

          {/* Title */}
          <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
            {article.title}
          </h3>

          {/* Description / AI Summary */}
          {displayText && (
            <p className={clsx('text-xs leading-relaxed text-gray-500', textClamp)}>
              {displayText}
            </p>
          )}

          {/* Deep mode: "Why am I seeing this?" */}
          {depthMode === 'deep' ? (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-300">
              <span>✦</span>
              <span>{article.reason ?? `From ${article.source} · ${article.category} · ${article.sentiment} tone`}</span>
            </p>
          ) : null}

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between">
            <SentimentBadge sentiment={article.sentiment} />
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <FeedbackMenu
                articleId={article.id}
                source={article.source}
                showTooltip={showFeedbackTooltip}
                onTooltipDismissed={onFeedbackTooltipDismissed}
                onFeedback={handleFeedback}
              />
              <button
                onClick={handleSave}
                className={clsx(
                  'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                  isSaved
                    ? 'text-blue-600'
                    : 'text-gray-300 hover:text-gray-400'
                )}
                aria-label={isSaved ? 'Remove bookmark' : 'Bookmark article'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={isSaved ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Image */}
        {article.imageUrl && (
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
            <Image
              src={article.imageUrl}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </article>
  )
}
