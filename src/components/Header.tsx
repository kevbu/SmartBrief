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

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return 'Yesterday'
}

export default function Header({
  onRefresh,
  isRefreshing,
  lastRefreshed,
  moodPreset,
  onMoodChange,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">SmartBrief</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {isRefreshing ? 'Refreshing...' : formatLastRefreshed(lastRefreshed)}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Refresh news"
        >
          {isRefreshing ? (
            <LoadingSpinner size="sm" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mood preset toggle */}
      <div className="px-4 pb-3">
        <MoodPresetToggle
          value={moodPreset}
          onChange={onMoodChange}
          disabled={isRefreshing}
        />
      </div>
    </header>
  )
}
