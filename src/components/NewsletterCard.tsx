'use client'

import { formatDistanceToNow } from 'date-fns'
import type { Article } from '@/types'

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
        'mx-4 mb-2 overflow-hidden rounded-2xl bg-white ring-1 transition-all dark:bg-slate-900',
        article.isRead
          ? 'border-l-4 border-transparent opacity-60 ring-slate-100 dark:ring-slate-800'
          : 'border-l-4 border-blue-500 ring-slate-100 dark:ring-slate-800',
      ].join(' ')}
    >
      {/* Header row — always visible, click to toggle */}
      <div
        className="cursor-pointer px-4 py-3"
        onClick={handleHeaderClick}
        role="button"
        aria-expanded={isExpanded}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
            {article.source}
          </span>
          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{timeAgo}</span>
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">
          {article.title}
        </p>
        {article.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {article.description}
          </p>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-4 pb-4 dark:border-slate-800">
          <div className="flex justify-end pt-2">
            <button
              onClick={onCollapse}
              className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <path d="M18 15l-6-6-6 6" />
              </svg>
              Close
            </button>
          </div>
          {bodyContent ? (
            <div className="mt-2 max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300 [&_a]:text-blue-500 [&_a]:underline [&_a]:underline-offset-2 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-4">
                {bodyContent}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">No content available.</p>
          )}
        </div>
      )}
    </article>
  )
}
