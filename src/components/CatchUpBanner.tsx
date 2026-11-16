'use client'

interface CatchUpBannerProps {
  gapDays: number
  onDismiss: () => void
}

export default function CatchUpBanner({ gapDays, onDismiss }: CatchUpBannerProps) {
  const label = gapDays === 1 ? 'the last day' : `the last ${gapDays} days`

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent-soft px-4 py-3">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-shrink-0 text-accent">
        <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <p className="flex-1 text-xs leading-relaxed text-accent-ink">
        Catching up from {label} — top stories ranked by importance.
      </p>
      <button
        onClick={onDismiss}
        className="min-h-[36px] flex-shrink-0 cursor-pointer rounded-full bg-card px-3 text-xs font-semibold text-accent-ink shadow-card transition-colors hover:bg-raised"
      >
        Show today
      </button>
    </div>
  )
}
