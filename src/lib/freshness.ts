// Pure helpers for the header's date and "Updated … ago" line.
// `now` is always passed in so the header can re-render on a clock tick
// and the tests can pin time.

/** Data older than this shows an amber dot instead of the green one. */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000

export type Freshness = 'fresh' | 'stale' | 'never'

export function formatToday(now: Date): string {
  return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatLastRefreshed(dateStr: string | null, now: Date): string {
  if (!dateStr) return 'Never synced'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Never synced'

  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (diffMins < 1) return 'Updated just now'
  if (diffMins < 60) return `Updated ${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Updated ${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Updated yesterday'
  return `Updated ${diffDays}d ago`
}

export function freshnessOf(dateStr: string | null, now: Date): Freshness {
  if (!dateStr) return 'never'
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return 'never'
  return now.getTime() - t > STALE_AFTER_MS ? 'stale' : 'fresh'
}
