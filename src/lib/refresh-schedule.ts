import type { RefreshMode } from '@/types'

/**
 * Scheduled refresh. Pure "is a refresh due?" logic; the timer and DB side
 * live in scheduler.ts.
 */

export const REFRESH_MODES: readonly RefreshMode[] = ['manual', 'interval', 'daily']
export const DEFAULT_REFRESH_MODE: RefreshMode = 'manual'
export const DEFAULT_DAILY_TIME = '07:00'
/** Guards against a bad value causing near-continuous Claude calls. */
export const MIN_INTERVAL_MINS = 15
/** After a failed scheduled refresh, the tick waits this long before retrying. */
export const FAILURE_BACKOFF_MS = 15 * 60 * 1000

const MS_PER_MIN = 60 * 1000

export function isRefreshMode(raw: unknown): raw is RefreshMode {
  return typeof raw === 'string' && (REFRESH_MODES as readonly string[]).includes(raw)
}

/** Unknown values fail closed to `manual` (no background cost). */
export function parseRefreshMode(raw: unknown): RefreshMode {
  return isRefreshMode(raw) ? raw : DEFAULT_REFRESH_MODE
}

/** Strict `HH:MM`, hours 0–23, minutes 0–59. */
export function parseDailyTime(raw: unknown): { hours: number; minutes: number } | null {
  if (typeof raw !== 'string') return null
  const match = /^(\d{2}):(\d{2})$/.exec(raw)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

/**
 * Settings time input: keep the last valid value when the input is cleared or
 * holds a partial value, so the page never sends a time the API rejects.
 */
export function nextDailyTimeInput(input: string, previous: string): string {
  return parseDailyTime(input) ? input : previous
}

/**
 * Settings load: a legacy row can hold an interval below the minimum. Clamp it
 * so the page never sends a value the API rejects.
 */
export function clampIntervalMins(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  return Math.max(Math.round(raw), MIN_INTERVAL_MINS)
}

/** Today at the given local time if that is not in the future, else yesterday at that time. */
export function mostRecentDailySlot(now: Date, time: { hours: number; minutes: number }): Date {
  const slot = new Date(now)
  slot.setHours(time.hours, time.minutes, 0, 0)
  if (slot.getTime() > now.getTime()) {
    slot.setDate(slot.getDate() - 1)
    slot.setHours(time.hours, time.minutes, 0, 0)
  }
  return slot
}

export function isRefreshDue(input: {
  mode: RefreshMode
  intervalMins: number
  dailyTime: string
  lastRefreshed: Date | null
  now: Date
}): boolean {
  const { mode, intervalMins, dailyTime, lastRefreshed, now } = input

  if (mode === 'interval') {
    if (!lastRefreshed) return true
    const mins = Number.isFinite(intervalMins) ? Math.max(intervalMins, MIN_INTERVAL_MINS) : MIN_INTERVAL_MINS
    return now.getTime() - lastRefreshed.getTime() >= mins * MS_PER_MIN
  }

  if (mode === 'daily') {
    const time = parseDailyTime(dailyTime)
    if (!time) return false
    if (!lastRefreshed) return true
    return mostRecentDailySlot(now, time).getTime() > lastRefreshed.getTime()
  }

  return false
}

export function isBackoffActive(lastFailureAt: Date | null, now: Date): boolean {
  if (!lastFailureAt) return false
  return now.getTime() - lastFailureAt.getTime() < FAILURE_BACKOFF_MS
}

/** Kill switch SMARTBRIEF_SCHEDULER. Unset means on. */
export function isSchedulerEnabled(env: string | undefined): boolean {
  const value = env?.trim().toLowerCase()
  return !(value === 'off' || value === 'false' || value === '0')
}

/**
 * Validates the auto-refresh fields of a PUT /api/preferences body. Only
 * fields that are present are returned in `data`.
 */
export function validateRefreshPrefsInput(body: {
  refreshMode?: unknown
  refreshDailyTime?: unknown
  refreshIntervalMins?: unknown
}):
  | {
      ok: true
      data: { refreshMode?: RefreshMode; refreshDailyTime?: string; refreshIntervalMins?: number }
    }
  | { ok: false; error: string } {
  const data: { refreshMode?: RefreshMode; refreshDailyTime?: string; refreshIntervalMins?: number } = {}
  if (body.refreshMode !== undefined) {
    if (!isRefreshMode(body.refreshMode)) return { ok: false, error: 'Invalid refreshMode' }
    data.refreshMode = body.refreshMode
  }
  if (body.refreshDailyTime !== undefined) {
    if (!parseDailyTime(body.refreshDailyTime)) {
      return { ok: false, error: 'refreshDailyTime must be HH:MM' }
    }
    data.refreshDailyTime = body.refreshDailyTime as string
  }
  if (body.refreshIntervalMins !== undefined) {
    const mins = body.refreshIntervalMins
    if (typeof mins !== 'number' || !Number.isInteger(mins) || mins < MIN_INTERVAL_MINS) {
      return {
        ok: false,
        error: `refreshIntervalMins must be an integer of at least ${MIN_INTERVAL_MINS}`,
      }
    }
    data.refreshIntervalMins = mins
  }
  return { ok: true, data }
}
