'use client'

import { clsx } from 'clsx'
import FeedbackMenu from './FeedbackMenu'
import SourceMark from './SourceMark'
import CategoryIcon, { CATEGORY_LABELS, SentimentDot } from './CategoryIcon'
import type { TopStory, FeedbackType, DepthMode } from '@/types'

interface TopStoryCardProps {
  story: TopStory
  depthMode?: DepthMode
  onSelect?: (topStory: TopStory) => void
  onFeedback?: (id: string, feedback: FeedbackType) => void
  onToggleSave?: (id: string) => void
  isSaved?: boolean
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] leading-relaxed text-ink-soft">
      <span className="mt-[0.6em] h-1 w-1 flex-shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

export default function TopStoryCard({
  story,
  depthMode = 'skim',
  onSelect,
  onFeedback,
  onToggleSave,
  isSaved,
}: TopStoryCardProps) {
  const categoryLabel = CATEGORY_LABELS[story.category]
  const bullets = story.bullets ?? []
  const visibleBullets = depthMode === 'deep' ? bullets : bullets.slice(0, 2)

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    onToggleSave?.(story.id)
  }

  return (
    <article
      className={clsx(
        'group relative mx-4 mb-3 rounded-2xl border border-line bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-200',
        onSelect && 'hover:border-line-strong hover:shadow-lift'
      )}
    >
      {/* Eyebrow: category · sources · sentiment */}
      <div className="mb-2 flex items-center gap-2 text-ink-muted">
        {categoryLabel && (
          <span className="eyebrow flex items-center gap-1.5 text-accent-ink">
            <CategoryIcon category={story.category} className="h-3.5 w-3.5" />
            {categoryLabel}
          </span>
        )}
        <span className="text-[11px] tabular-nums">
          {categoryLabel && <span aria-hidden="true" className="mr-2 text-ink-faint">·</span>}
          {story.sources.length} {story.sources.length === 1 ? 'source' : 'sources'}
        </span>
        <span className="ml-auto">
          <SentimentDot sentiment={story.sentiment} />
        </span>
      </div>

      {/* Title — the stretched button makes the whole card clickable */}
      <h2 className="headline mb-2.5 text-[19px] font-semibold leading-[1.25]">
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(story)}
            className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:ring-0 focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {story.title}
          </button>
        ) : (
          story.title
        )}
      </h2>

      {/* Bullets or summary */}
      {visibleBullets.length > 0 ? (
        <ul className="mb-3 space-y-1.5">
          {visibleBullets.map((b, i) => (
            <Bullet key={i}>{b}</Bullet>
          ))}
          {depthMode !== 'deep' && bullets.length > 2 && (
            <li className="pl-3.5 text-xs font-medium text-ink-muted">+{bullets.length - 2} more points</li>
          )}
        </ul>
      ) : (
        <p className={clsx('mb-3 text-[13px] leading-relaxed text-ink-soft', depthMode !== 'deep' && 'line-clamp-2')}>
          {story.summary}
        </p>
      )}

      {/* Footer: sources + actions */}
      <div className="flex items-end justify-between gap-2 border-t border-line pt-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 py-1.5">
          {story.sources.slice(0, 3).map((source) => (
            <span
              key={source}
              className="inline-flex max-w-[9rem] items-center gap-1.5 rounded-full bg-well py-0.5 pl-0.5 pr-2.5 text-[11px] font-medium text-ink-soft"
            >
              <SourceMark source={source} size="xs" className="rounded-full" />
              <span className="truncate">{source}</span>
            </span>
          ))}
          {story.sources.length > 3 && (
            <span className="rounded-full bg-well px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-muted">
              +{story.sources.length - 3}
            </span>
          )}
        </div>

        <div className="relative -mb-1.5 -mr-2 flex flex-shrink-0 items-center">
          <button
            onClick={handleSave}
            aria-label={isSaved ? 'Unsave story' : 'Save story'}
            aria-pressed={!!isSaved}
            className={clsx(
              'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-well',
              isSaved ? 'text-accent' : 'text-ink-muted hover:text-ink'
            )}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            </svg>
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
    </article>
  )
}
