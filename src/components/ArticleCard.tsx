'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import type { Article } from '@/types'
import SentimentBadge from './SentimentBadge'
import { getEmojiForSource } from '@/lib/news-sources'

interface ArticleCardProps {
  article: Article
  onMarkRead: (id: string) => void
  onToggleSave: (id: string) => void
}

export default function ArticleCard({
  article,
  onMarkRead,
  onToggleSave,
}: ArticleCardProps) {
  const [isSaved, setIsSaved] = useState(article.isSaved)
  const [isRead, setIsRead] = useState(article.isRead)

  function handleClick() {
    if (!isRead) {
      setIsRead(true)
      onMarkRead(article.id)
    }
    window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    setIsSaved(!isSaved)
    onToggleSave(article.id)
  }

  const timeAgo = formatDistanceToNow(new Date(article.publishedAt), {
    addSuffix: true,
  })

  const displayText = article.aiSummary || article.description

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
          {/* Source and time */}
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-400">
            <span>{getEmojiForSource(article.source)}</span>
            <span className="font-medium text-gray-500">{article.source}</span>
            <span>·</span>
            <span>{timeAgo}</span>
          </div>

          {/* Title */}
          <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
            {article.title}
          </h3>

          {/* Description */}
          {displayText && (
            <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">
              {displayText}
            </p>
          )}

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between">
            <SentimentBadge sentiment={article.sentiment} />
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
