'use client'

import { clsx } from 'clsx'
import FeedbackMenu from './FeedbackMenu'
import type { TopStory, FeedbackType, DepthMode } from '@/types'

interface TopStoryCardProps {
  story: TopStory
  depthMode?: DepthMode
  onSelect?: (topStory: TopStory) => void
  onFeedback?: (id: string, feedback: FeedbackType) => void
  onToggleSave?: (id: string) => void
  isSaved?: boolean
}

const sentimentStyles = {
  positive: 'bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/60',
  neutral:  'bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800',
  negative: 'bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/60',
}

const sentimentAccent = {
  positive: 'bg-emerald-500',
  neutral:  'bg-blue-500',
  negative: 'bg-amber-500',
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'technology':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      )
    case 'science':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l3 3 3-3V3M3 9h18" />
        </svg>
      )
    case 'business':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
        </svg>
      )
    case 'world':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'positive':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )
    default:
      return null
  }
}

const categoryLabels: Record<string, string> = {
  technology: 'Tech & AI',
  science:    'Science & Health',
  business:   'Business',
  world:      'World',
  positive:   'Bright Spots',
}

export default function TopStoryCard({
  story,
  depthMode = 'skim',
  onSelect,
  onFeedback,
  onToggleSave,
  isSaved,
}: TopStoryCardProps) {
  const bg = sentimentStyles[story.sentiment] ?? sentimentStyles.neutral
  const accent = sentimentAccent[story.sentiment] ?? sentimentAccent.neutral

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
        'mx-4 mb-2 overflow-hidden rounded-2xl transition-all',
        onSelect ? 'cursor-pointer active:scale-[0.99] hover:brightness-[0.98] dark:hover:brightness-110' : '',
        bg
      )}
    >
      {/* Colored left accent bar */}
      <div className="flex">
        <div className={clsx('w-1 flex-shrink-0 rounded-l-2xl', accent)} />

        <div className="min-w-0 flex-1 p-4">
          {/* Label row */}
          <div className="mb-2.5 flex items-center gap-2">
            <span className="rounded-full bg-blue-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
              Top Story
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {story.sources.length} {story.sources.length === 1 ? 'source' : 'sources'}
            </span>
            {categoryLabels[story.category] && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <CategoryIcon category={story.category} />
                {categoryLabels[story.category]}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="mb-2.5 text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-100">
            {story.title}
          </h2>

          {/* Bullets or summary */}
          {depthMode === 'deep' ? (
            story.bullets && story.bullets.length > 0 ? (
              <ul className="mb-3 space-y-1.5">
                {story.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="mt-0.5 flex-shrink-0 text-slate-300 dark:text-slate-600">–</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {story.summary}
              </p>
            )
          ) : (
            story.bullets && story.bullets.length > 0 ? (
              <ul className="mb-3 space-y-1">
                {story.bullets.slice(0, 2).map((b, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="mt-0.5 flex-shrink-0 text-slate-300 dark:text-slate-600">–</span>
                    <span>{b}</span>
                  </li>
                ))}
                {story.bullets.length > 2 && (
                  <li className="pl-4 text-xs text-slate-400 dark:text-slate-500">
                    +{story.bullets.length - 2} more…
                  </li>
                )}
              </ul>
            ) : (
              <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {story.summary}
              </p>
            )
          )}

          {/* Source pills */}
          {story.sources.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {story.sources.slice(0, 4).map((source) => (
                <span
                  key={source}
                  className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/60 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700/60"
                >
                  {source}
                </span>
              ))}
              {story.sources.length > 4 && (
                <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-200/60 dark:bg-slate-800/80 dark:text-slate-500 dark:ring-slate-700/60">
                  +{story.sources.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleSave}
              aria-label={isSaved ? 'Unsave story' : 'Save story'}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isSaved ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-blue-500">
                  <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-slate-400 dark:text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
              )}
            </button>
            <FeedbackMenu
              articleId={story.id}
              source=""
              excludeOptions={['hide-source']}
              onFeedback={(feedback) => onFeedback?.(story.id, feedback)}
              placement="right"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
