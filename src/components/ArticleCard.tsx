'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import type { Article, DepthMode, FeedbackType } from '@/types'
import SentimentBadge from './SentimentBadge'
import BiasBadge from './BiasBadge'
import FeedbackMenu from './FeedbackMenu'
import { getEmojiForSource } from '@/lib/news-sources'

interface ArticleCardProps {
  article: Article
  depthMode?: DepthMode
  onMarkRead: (id: string) => void
  onToggleSave: (id: string) => void
  onFeedback?: (id: string, feedback: FeedbackType) => void
  onSelect?: (article: Article) => void
}

export default function ArticleCard({
  article,
  depthMode = 'skim',
  onMarkRead,
  onToggleSave,
  onFeedback,
  onSelect,
}: ArticleCardProps) {
  const [isSaved, setIsSaved] = useState(article.isSaved)
  const [isRead, setIsRead] = useState(article.isRead)
  const [hidden, setHidden] = useState(false)

  function handleClick() {
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
    }
  }

  if (hidden) return null

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
            <span>{getEmojiForSource(article.source)}</span>
            <span className="font-medium text-gray-500">{article.source}</span>
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
          {depthMode === 'deep' && (
            <p className="mt-1.5 text-[10px] text-gray-300">
              From {article.source} · {article.category} · {article.sentiment} tone
            </p>
          )}

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between">
            <SentimentBadge sentiment={article.sentiment} />
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <FeedbackMenu
                articleId={article.id}
                source={article.source}
                onFeedback={handleFeedback}
              />
              <button
                onClick={handleSave}
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
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
          <div className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.imageUrl}
              alt=""
              className="h-20 w-20 rounded-lg object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        )}
      </div>
    </article>
  )
}
