'use client'

interface CatchUpBannerProps {
  gapDays: number
  onDismiss: () => void
}

export default function CatchUpBanner({ gapDays, onDismiss }: CatchUpBannerProps) {
  const label =
    gapDays === 1 ? 'the last day' : `the last ${gapDays} days`

  return (
    <div className="mx-4 mb-3 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
      <p className="text-xs text-blue-700">
        Catching up from {label} — top stories ranked by importance.
      </p>
      <button
        onClick={onDismiss}
        className="ml-3 shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
      >
        Today&apos;s briefing →
      </button>
    </div>
  )
}
