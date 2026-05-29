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
      <div className="mx-4 mb-3 rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/60">
        <div className="mb-2 flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-emerald-500">
            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="mb-1 text-base font-bold text-emerald-800 dark:text-emerald-200">
          {isCatchUp ? "You're caught up!" : 'Briefing complete!'}
        </h3>
        <p className="mb-3 text-xs text-emerald-600 dark:text-emerald-400">
          {isCatchUp
            ? "You've read your catch-up brief. You're all caught up."
            : "You've read your daily brief. Great job staying informed without overdoing it."}
        </p>
        <button
          onClick={onLoadMore}
          className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Load more stories
        </button>
      </div>
    )
  }

  const hour = new Date().getHours()
  const sessionLabel = hour < 12 ? 'Morning Brief' : hour < 17 ? 'Afternoon Brief' : 'Evening Brief'

  return (
    <div className="mx-4 mb-2.5">
      <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">{sessionLabel}</span>
        <span>{current} of {total} stories</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
