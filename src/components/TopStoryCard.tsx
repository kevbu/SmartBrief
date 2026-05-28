'use client'

import { clsx } from 'clsx'
import FeedbackMenu from './FeedbackMenu'
import type { TopStory, FeedbackType } from '@/types'

interface TopStoryCardProps {
  story: TopStory
  onSelect?: (topStory: TopStory) => void
  onFeedback?: (id: string, feedback: FeedbackType) => void
  onToggleSave?: (id: string) => void
  isSaved?: boolean
}

const sentimentGradients = {
  positive:
    'from-emerald-50 to-teal-50 border border-emerald-100 dark:from-emerald-950 dark:to-teal-950 dark:border-emerald-900',
  neutral: 'from-gray-50 to-slate-50 border border-gray-100 dark:from-gray-900 dark:to-slate-900 dark:border-gray-800',
  negative: 'from-amber-50 to-orange-50 border border-amber-100 dark:from-amber-950 dark:to-orange-950 dark:border-amber-900',
}

const categoryLabels: Record<string, string> = {
  technology: '🤖 Tech & AI',
  science: '🧪 Science & Health',
  business: '📊 Business',
  world: '🌍 World',
  positive: '✨ Bright Spots',
}

export default function TopStoryCard({
  story,
  onSelect,
  onFeedback,
  onToggleSave,
  isSaved,
}: TopStoryCardProps) {
  const gradient =
    sentimentGradients[story.sentiment] ?? sentimentGradients.neutral

  function handleClick() {
    onSelect?.(story)
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    onToggleSave?.(story.id)
  }

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'mx-4 mb-3 rounded-xl bg-gradient-to-br p-4 shadow-sm',
        onSelect ? 'cursor-pointer active:scale-[0.99] transition-all' : '',
        gradient
      )}
    >
      {/* Label row */}
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          Top Story
        </span>
        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          {story.sources.length} {story.sources.length === 1 ? 'Quelle' : 'Quellen'}
        </span>
        {categoryLabels[story.category] && (
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {categoryLabels[story.category]}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="mb-2 text-base font-bold leading-snug text-gray-900 dark:text-gray-100">
        {story.title}
      </h2>

      {/* 2 bullets max, or truncated summary */}
      {story.bullets && story.bullets.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {story.bullets.slice(0, 2).map((b, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
              <span className="mt-0.5 flex-shrink-0 text-gray-400">·</span>
              <span>{b}</span>
            </li>
          ))}
          {story.bullets.length > 2 && (
            <li className="text-xs text-gray-400 dark:text-gray-500 pl-4">
              +{story.bullets.length - 2} more…
            </li>
          )}
        </ul>
      ) : (
        <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {story.summary}
        </p>
      )}

      {/* Source pills */}
      {story.sources.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {story.sources.slice(0, 4).map((source) => (
            <span
              key={source}
              className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-gray-600 shadow-sm dark:bg-gray-800/70 dark:text-gray-300"
            >
              {source}
            </span>
          ))}
          {story.sources.length > 4 && (
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-gray-400 shadow-sm dark:bg-gray-800/70 dark:text-gray-500">
              +{story.sources.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Action row: feedback + read more hint + save */}
      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <FeedbackMenu
          articleId={story.id}
          source=""
          excludeOptions={['hide-source']}
          onFeedback={(feedback) => onFeedback?.(story.id, feedback)}
        />

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 dark:text-gray-500">Tap for sources</span>
          <button
            onClick={handleSave}
            aria-label={isSaved ? 'Unsave story' : 'Save story'}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            {isSaved ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-blue-500">
                <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
