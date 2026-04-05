'use client'

interface SessionProgressProps {
  current: number
  total: number
  onLoadMore: () => void
  isCatchUp?: boolean
}

export default function SessionProgress({ current, total, onLoadMore, isCatchUp = false }: SessionProgressProps) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const isComplete = current >= total

  if (isComplete) {
    return (
      <div className="mx-4 mb-4 rounded-2xl bg-emerald-50 p-5 text-center">
        <div className="mb-2 text-3xl">🌟</div>
        <h3 className="mb-1 text-base font-bold text-emerald-800">
          {isCatchUp ? "You're caught up!" : 'Briefing complete!'}
        </h3>
        <p className="mb-3 text-xs text-emerald-600">
          {isCatchUp
            ? "You\u2019ve read your catch-up brief. You\u2019re all caught up."
            : "You\u2019ve read your daily brief. Great job staying informed without overdoing it."}
        </p>
        <button
          onClick={onLoadMore}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Load more stories
        </button>
      </div>
    )
  }

  const hour = new Date().getHours()
  const sessionLabel = hour < 12 ? 'Morning Brief' : hour < 17 ? 'Afternoon Brief' : 'Evening Brief'

  return (
    <div className="mx-4 mb-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium">{sessionLabel}</span>
        <span>{current} of {total} stories</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
