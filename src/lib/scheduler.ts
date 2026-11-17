import { db } from './db'
import { refreshNews } from './news-aggregator'
import { pollImap, isImapPollDue } from './imap-poller'
import { detectAndPush, isDetectDue } from './breaking-news-detector'
import {
  isBackoffActive,
  isRefreshDue,
  isSchedulerEnabled,
  parseRefreshMode,
} from './refresh-schedule'

/**
 * Scheduled refresh. A one-minute tick reads the preferences and
 * AppState.lastRefreshed and asks isRefreshDue() (refresh-schedule.ts).
 * Off by default (refreshMode = manual); SMARTBRIEF_SCHEDULER=off disables
 * the tick entirely.
 */

const TICK_MS = 60_000
const FIRST_TICK_MS = 5_000

const schedulerGlobal = globalThis as typeof globalThis & {
  __smartbriefSchedulerStarted?: boolean
}

let tickRunning = false
let lastFailureAt: Date | null = null

type PostRefreshTask = 'imap' | 'detect'

// In-flight piggyback tasks. A tick can join a manual refresh's promise, so both
// callers reach runPostRefreshTasks(). The due-checks read timestamps that the
// task writes only at its end, so without this guard both would start it.
// Kept on globalThis for the same hot-reload reason as the start guard.
const postRefreshGlobal = globalThis as typeof globalThis & {
  __smartbriefPostRefreshInFlight?: Partial<Record<PostRefreshTask, boolean>>
}

function inFlightTasks(): Partial<Record<PostRefreshTask, boolean>> {
  return (postRefreshGlobal.__smartbriefPostRefreshInFlight ??= {})
}

/**
 * Claims the task slot synchronously, awaits the due-check, then starts the task
 * fire-and-forget. The slot is released when the task settles, or right away
 * when the task is not due or the due-check fails.
 */
async function runPostRefreshTask(
  key: PostRefreshTask,
  isDue: () => Promise<boolean>,
  run: () => Promise<unknown>,
  label: string
): Promise<void> {
  const inFlight = inFlightTasks()
  if (inFlight[key]) return
  inFlight[key] = true
  let started = false
  try {
    if (await isDue()) {
      started = true
      Promise.resolve()
        .then(run)
        .catch((err) => console.error(`[refresh] ${label} error:`, err))
        .finally(() => {
          inFlight[key] = false
        })
    }
  } catch (err) {
    console.error(`[refresh] ${label} error:`, err)
  } finally {
    if (!started) inFlight[key] = false
  }
}

/**
 * IMAP poll and breaking-news detection, each behind its own due-check and
 * single-flight guard. Fire-and-forget: only the due-checks are awaited, errors
 * are logged and never reach the caller.
 */
export async function runPostRefreshTasks(): Promise<void> {
  await runPostRefreshTask('imap', isImapPollDue, pollImap, 'IMAP poll')
  await runPostRefreshTask('detect', isDetectDue, detectAndPush, 'Breaking-news detect')
}

export async function tick(now: Date = new Date()): Promise<void> {
  if (tickRunning || isBackoffActive(lastFailureAt, now)) return
  tickRunning = true
  try {
    const [prefs, state] = await Promise.all([
      db.userPreferences.findUnique({ where: { id: 'default' } }),
      db.appState.findUnique({ where: { id: 'default' } }),
    ])
    if (!prefs) return

    const mode = parseRefreshMode(prefs.refreshMode)
    const lastRefreshed = state?.lastRefreshed ?? null
    const due = isRefreshDue({
      mode,
      intervalMins: prefs.refreshIntervalMins,
      dailyTime: prefs.refreshDailyTime,
      lastRefreshed,
      now,
    })
    if (!due) return

    console.log(
      `[scheduler] refresh due (mode=${mode}, last=${lastRefreshed ? lastRefreshed.toISOString() : 'never'})`
    )
    try {
      await refreshNews()
      lastFailureAt = null
    } catch (err) {
      lastFailureAt = now
      console.error('[scheduler] refresh failed, retrying in 15 min:', err)
      return
    }
    await runPostRefreshTasks()
  } catch (err) {
    console.error('[scheduler] tick error:', err)
  } finally {
    tickRunning = false
  }
}

export function startBackgroundRefresh(): void {
  if (!isSchedulerEnabled(process.env.SMARTBRIEF_SCHEDULER)) {
    console.log('[scheduler] disabled via SMARTBRIEF_SCHEDULER')
    return
  }
  if (schedulerGlobal.__smartbriefSchedulerStarted) return
  schedulerGlobal.__smartbriefSchedulerStarted = true

  const run = () => {
    void tick()
  }
  setTimeout(run, FIRST_TICK_MS).unref?.()
  setInterval(run, TICK_MS).unref?.()
  console.log('[scheduler] started (1-minute tick)')
}

/** Test-only: reset in-memory state. */
export function __resetSchedulerForTests(): void {
  tickRunning = false
  lastFailureAt = null
  schedulerGlobal.__smartbriefSchedulerStarted = false
  postRefreshGlobal.__smartbriefPostRefreshInFlight = {}
}
