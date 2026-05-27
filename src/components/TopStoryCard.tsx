import { clsx } from 'clsx'
import type { TopStory } from '@/types'

interface TopStoryCardProps {
  story: TopStory
  onSelect?: (topStory: TopStory) => void
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

export default function TopStoryCard({ story, onSelect }: TopStoryCardProps) {
  const gradient =
    sentimentGradients[story.sentiment] ?? sentimentGradients.neutral

  function handleClick() {
    onSelect?.(story)
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

      {/* Bullets or summary fallback */}
      {story.bullets && story.bullets.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {story.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
              <span className="mt-0.5 flex-shrink-0 text-gray-400">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {story.summary}
        </p>
      )}

      {/* Cluster article links */}
      {story.clusterArticles && story.clusterArticles.length > 0 && (
        <div className="mb-3 space-y-1 border-t border-gray-100 pt-2 dark:border-gray-800">
          {story.clusterArticles.slice(0, 5).map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <span className="flex-shrink-0 font-medium">{a.source}</span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="flex-1 line-clamp-1">{a.title}</span>
              <span className="flex-shrink-0 text-gray-400">↗</span>
            </a>
          ))}
        </div>
      )}

      {/* Source pills */}
      {story.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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
    </div>
  )
}
