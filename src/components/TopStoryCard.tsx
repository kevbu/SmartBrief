import { clsx } from 'clsx'
import type { TopStory } from '@/types'

interface TopStoryCardProps {
  story: TopStory
}

const sentimentGradients = {
  positive:
    'from-emerald-50 to-teal-50 border border-emerald-100',
  neutral: 'from-gray-50 to-slate-50 border border-gray-100',
  negative: 'from-amber-50 to-orange-50 border border-amber-100',
}

const categoryLabels: Record<string, string> = {
  technology: '🤖 Tech & AI',
  science: '🧪 Science & Health',
  business: '📊 Business',
  world: '🌍 World',
  positive: '✨ Bright Spots',
}

export default function TopStoryCard({ story }: TopStoryCardProps) {
  const gradient =
    sentimentGradients[story.sentiment] ?? sentimentGradients.neutral

  return (
    <div
      className={clsx(
        'mx-4 mb-3 rounded-xl bg-gradient-to-br p-4 shadow-sm',
        gradient
      )}
    >
      {/* Label row */}
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          Top Story
        </span>
        {categoryLabels[story.category] && (
          <span className="text-xs text-gray-500">
            {categoryLabels[story.category]}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="mb-2 text-base font-bold leading-snug text-gray-900">
        {story.title}
      </h2>

      {/* Summary */}
      <p className="mb-3 text-sm leading-relaxed text-gray-700">
        {story.summary}
      </p>

      {/* Source pills */}
      {story.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {story.sources.slice(0, 4).map((source) => (
            <span
              key={source}
              className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-gray-600 shadow-sm"
            >
              {source}
            </span>
          ))}
          {story.sources.length > 4 && (
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-gray-400 shadow-sm">
              +{story.sources.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}
