'use client'

import LoadingSpinner from './LoadingSpinner'
import MoodPresetToggle from './MoodPresetToggle'
import type { MoodPreset } from '@/types'

interface HeaderProps {
  onRefresh: () => void
  isRefreshing: boolean
  lastRefreshed: string | null
  moodPreset: MoodPreset
  onMoodChange: (preset: MoodPreset) => void
}

function formatLastRefreshed(dateStr: string | null): string {
  if (!dateStr) return 'Never synced'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Updated just now'
  if (diffMins < 60) return `Updated ${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Updated ${diffHours}h ago`
  return 'Updated yesterday'
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-shrink-0 items-center justify-center rounded-[10px] bg-ink font-serif text-[19px] font-semibold italic leading-none text-paper ${className}`}
    >
      S
    </span>
  )
}

export default function Header({
  onRefresh,
  isRefreshing,
  lastRefreshed,
  moodPreset,
  onMoodChange,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark />
          <div className="min-w-0">
            <h1 className="headline text-[22px] font-semibold leading-none">SmartBrief</h1>
            <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-ink-muted">
              <span suppressHydrationWarning>{formatToday()}</span>
              <span aria-hidden="true" className="text-ink-faint">·</span>
              {isRefreshing ? (
                <span>Refreshing…</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
                  {formatLastRefreshed(lastRefreshed)}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-ink-soft shadow-card transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
          aria-label="Refresh news"
        >
          {isRefreshing ? (
            <LoadingSpinner size="sm" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          )}
        </button>
      </div>

      <div className="px-4 pb-3">
        <MoodPresetToggle value={moodPreset} onChange={onMoodChange} disabled={isRefreshing} />
      </div>
    </header>
  )
}
