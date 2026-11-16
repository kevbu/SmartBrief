'use client'

import { formatDistanceToNow } from 'date-fns'
import type { Article } from '@/types'
import SourceMark from './SourceMark'

interface NewsletterCardProps {
  article: Article
  isExpanded: boolean
  onExpand: (id: string) => void
  onCollapse: () => void
}

export default function NewsletterCard({ article, isExpanded, onExpand, onCollapse }: NewsletterCardProps) {
  const timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })

  const bodyContent = article.content || article.description || null

  function handleHeaderClick() {
    if (isExpanded) {
      onCollapse()
    } else {
      onExpand(article.id)
    }
  }

  return (
    <article
      className={[
        'relative mx-4 mb-3 overflow-hidden rounded-2xl border border-line bg-card shadow-card transition-[border-color,opacity] duration-200 hover:border-line-strong',
        article.isRead && !isExpanded ? 'opacity-65' : '',
      ].join(' ')}
    >
      {/* Header row — always visible, click to toggle */}
      <div
        className="cursor-pointer px-4 py-3.5"
        onClick={handleHeaderClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleHeaderClick()
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <SourceMark source={article.source} size="sm" />
            <span className="truncate text-xs font-semibold text-ink-soft">{article.source}</span>
            {!article.isRead && (
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-accent" aria-label="Unread" />
            )}
          </span>
          <span className="shrink-0 text-xs text-ink-muted">{timeAgo}</span>
        </div>
        <p className="headline line-clamp-2 text-[17px] font-semibold leading-[1.3]">
          {article.title}
        </p>
        {article.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
            {article.description}
          </p>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-line px-4 pb-4">
          <div className="flex justify-end pt-2">
            <button
              onClick={onCollapse}
              className="flex min-h-[32px] cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-well hover:text-ink"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <path d="M18 15l-6-6-6 6" />
              </svg>
              Close
            </button>
          </div>
          {bodyContent ? (
            <div className="mt-2 max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-4">
                {bodyContent}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">No content available.</p>
          )}
        </div>
      )}
    </article>
  )
}
