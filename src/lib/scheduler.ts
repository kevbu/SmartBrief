import cron from 'node-cron'
import { refreshNews } from './news-aggregator'
import { db } from './db'

const INTERVAL_HOURS = 6

export async function startBackgroundRefresh() {
  // One-time migration: bump the 60-min default to match the 6-hour schedule
  await db.userPreferences.updateMany({
    where: { id: 'default', refreshIntervalMins: 60 },
    data: { refreshIntervalMins: 360 },
  })

  // Refresh immediately on startup if data is stale (>6h or never refreshed)
  const state = await db.appState.findUnique({ where: { id: 'default' } })
  const staleThresholdMs = INTERVAL_HOURS * 60 * 60 * 1000
  const isStale =
    !state?.lastRefreshed ||
    Date.now() - state.lastRefreshed.getTime() > staleThresholdMs

  if (isStale) {
    console.log('[scheduler] Stale on startup — running initial refresh')
    refreshNews().catch(e => console.error('[scheduler] Startup refresh failed:', e))
  }

  cron.schedule(`0 */${INTERVAL_HOURS} * * *`, () => {
    console.log('[scheduler] Running scheduled refresh')
    refreshNews().catch(e => console.error('[scheduler] Scheduled refresh failed:', e))
  })

  console.log(`[scheduler] Background refresh scheduled every ${INTERVAL_HOURS}h`)
}
