/**
 * Scheduler runtime: timer registration, kill switch, tick → refresh →
 * piggyback, failure backoff. DB, aggregator, IMAP and push are mocked.
 */
import { FAILURE_BACKOFF_MS } from './refresh-schedule'

const prefsRow = vi.hoisted(() => ({
  current: null as null | { refreshMode: string; refreshIntervalMins: number; refreshDailyTime: string },
}))
const stateRow = vi.hoisted(() => ({ current: null as null | { lastRefreshed: Date | null } }))

vi.mock('./db', () => ({
  db: {
    userPreferences: { findUnique: vi.fn(async () => prefsRow.current) },
    appState: { findUnique: vi.fn(async () => stateRow.current) },
  },
}))
vi.mock('./news-aggregator', () => ({ refreshNews: vi.fn() }))
vi.mock('./imap-poller', () => ({ pollImap: vi.fn(), isImapPollDue: vi.fn() }))
vi.mock('./breaking-news-detector', () => ({ detectAndPush: vi.fn(), isDetectDue: vi.fn() }))

import { refreshNews } from './news-aggregator'
import { pollImap, isImapPollDue } from './imap-poller'
import { detectAndPush, isDetectDue } from './breaking-news-detector'
import { __resetSchedulerForTests, runPostRefreshTasks, startBackgroundRefresh, tick } from './scheduler'

const NOW = new Date(2026, 10, 17, 12, 0, 0, 0)
const HOUR = 60 * 60 * 1000

beforeEach(() => {
  __resetSchedulerForTests()
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prefsRow.current = { refreshMode: 'interval', refreshIntervalMins: 60, refreshDailyTime: '07:00' }
  stateRow.current = { lastRefreshed: new Date(NOW.getTime() - 2 * HOUR) }
  vi.mocked(refreshNews).mockResolvedValue({ articleCount: 1, lastRefreshed: NOW })
  vi.mocked(isImapPollDue).mockResolvedValue(true)
  vi.mocked(isDetectDue).mockResolvedValue(true)
  vi.mocked(pollImap).mockResolvedValue(undefined as never)
  vi.mocked(detectAndPush).mockResolvedValue(undefined as never)
})

afterEach(() => {
  delete process.env.SMARTBRIEF_SCHEDULER
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('startBackgroundRefresh', () => {
  it('registers no timer when SMARTBRIEF_SCHEDULER=off', () => {
    process.env.SMARTBRIEF_SCHEDULER = 'off'
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    startBackgroundRefresh()
    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  it('registers one interval timer when called twice', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    startBackgroundRefresh()
    startBackgroundRefresh()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(setIntervalSpy.mock.calls[0][1]).toBe(60_000)
  })
})

describe('tick', () => {
  it('refreshes and runs the IMAP / breaking-news piggyback when due', async () => {
    await tick(NOW)
    expect(refreshNews).toHaveBeenCalledTimes(1)
    expect(pollImap).toHaveBeenCalledTimes(1)
    expect(detectAndPush).toHaveBeenCalledTimes(1)
  })

  it('respects the piggyback due-checks', async () => {
    vi.mocked(isImapPollDue).mockResolvedValue(false)
    vi.mocked(isDetectDue).mockResolvedValue(false)
    await tick(NOW)
    expect(refreshNews).toHaveBeenCalledTimes(1)
    expect(pollImap).not.toHaveBeenCalled()
    expect(detectAndPush).not.toHaveBeenCalled()
  })

  it('does nothing when not due', async () => {
    stateRow.current = { lastRefreshed: new Date(NOW.getTime() - 30 * 60 * 1000) }
    await tick(NOW)
    expect(refreshNews).not.toHaveBeenCalled()
  })

  it('does nothing in manual mode or without a preferences row', async () => {
    prefsRow.current = { refreshMode: 'manual', refreshIntervalMins: 60, refreshDailyTime: '07:00' }
    await tick(NOW)
    prefsRow.current = null
    await tick(NOW)
    expect(refreshNews).not.toHaveBeenCalled()
  })

  it('picks up a changed mode at the next tick', async () => {
    prefsRow.current = { refreshMode: 'manual', refreshIntervalMins: 60, refreshDailyTime: '07:00' }
    await tick(NOW)
    expect(refreshNews).not.toHaveBeenCalled()
    prefsRow.current = { refreshMode: 'daily', refreshIntervalMins: 60, refreshDailyTime: '07:00' }
    stateRow.current = { lastRefreshed: new Date(2026, 10, 16, 7, 0) }
    await tick(NOW)
    expect(refreshNews).toHaveBeenCalledTimes(1)
  })

  it('suppresses further attempts for 15 minutes after a failure', async () => {
    vi.mocked(refreshNews).mockRejectedValueOnce(new Error('feeds down'))
    await tick(NOW)
    expect(refreshNews).toHaveBeenCalledTimes(1)
    expect(pollImap).not.toHaveBeenCalled()

    await tick(new Date(NOW.getTime() + 60_000))
    await tick(new Date(NOW.getTime() + FAILURE_BACKOFF_MS - 1))
    expect(refreshNews).toHaveBeenCalledTimes(1)

    await tick(new Date(NOW.getTime() + FAILURE_BACKOFF_MS))
    expect(refreshNews).toHaveBeenCalledTimes(2)
  })

  it('never throws when the DB read fails', async () => {
    const { db } = await import('./db')
    vi.mocked(db.userPreferences.findUnique).mockRejectedValueOnce(new Error('db locked'))
    await expect(tick(NOW)).resolves.toBeUndefined()
    expect(refreshNews).not.toHaveBeenCalled()
  })
})

describe('runPostRefreshTasks', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('starts each task once when two callers run it concurrently', async () => {
    let releaseImap!: () => void
    vi.mocked(pollImap).mockImplementation(
      () => new Promise((resolve) => { releaseImap = () => resolve(undefined as never) })
    )
    await Promise.all([runPostRefreshTasks(), runPostRefreshTasks()])
    await flush()
    expect(pollImap).toHaveBeenCalledTimes(1)
    expect(detectAndPush).toHaveBeenCalledTimes(1)

    // A third caller while the poll is still running also skips it.
    await runPostRefreshTasks()
    await flush()
    expect(pollImap).toHaveBeenCalledTimes(1)

    releaseImap()
    await flush()
    await runPostRefreshTasks()
    await flush()
    expect(pollImap).toHaveBeenCalledTimes(2)
  })

  it('a tick that joins a manual refresh does not repeat the piggyback', async () => {
    vi.mocked(pollImap).mockImplementation(() => new Promise(() => {}))
    await Promise.all([tick(NOW), runPostRefreshTasks()])
    await flush()
    expect(pollImap).toHaveBeenCalledTimes(1)
  })

  it('releases the slot when the task is not due', async () => {
    vi.mocked(isImapPollDue).mockResolvedValueOnce(false)
    await runPostRefreshTasks()
    await runPostRefreshTasks()
    await flush()
    expect(pollImap).toHaveBeenCalledTimes(1)
  })

  it('releases the slot when the due-check or the task fails', async () => {
    vi.mocked(isImapPollDue).mockRejectedValueOnce(new Error('db locked'))
    await expect(runPostRefreshTasks()).resolves.toBeUndefined()
    vi.mocked(pollImap).mockRejectedValueOnce(new Error('imap down'))
    await runPostRefreshTasks()
    await flush()
    await runPostRefreshTasks()
    await flush()
    expect(pollImap).toHaveBeenCalledTimes(2)
  })
})
