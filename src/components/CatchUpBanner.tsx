'use client'

interface CatchUpBannerProps {
  gapDays: number
  onDismiss: () => void
}

export default function CatchUpBanner({ gapDays, onDismiss }: CatchUpBannerProps) {
  const label = gapDays === 1 ? 'the last day' : `the last ${gapDays} days`

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900/60">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-shrink-0 text-blue-500">
        <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <p className="flex-1 text-xs text-blue-700 dark:text-blue-300">
        Catching up from {label} — top stories ranked by importance.
      </p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 cursor-pointer text-xs font-semibold text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Today →
      </button>
    </div>
  )
}
