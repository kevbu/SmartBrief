import { NextResponse } from 'next/server'
import { refreshNews } from '@/lib/news-aggregator'
import { runPostRefreshTasks } from '@/lib/scheduler'
import type { RefreshApiResponse } from '@/types'

export async function POST() {
  try {
    const { articleCount, lastRefreshed } = await refreshNews()

    // Piggyback IMAP poll and breaking-news detection, each at its own cadence.
    // Only the due-checks are awaited; the poll and detection run fire-and-forget.
    await runPostRefreshTasks()

    const response: RefreshApiResponse = {
      success: true,
      articleCount,
      lastRefreshed: lastRefreshed.toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Error refreshing news:', err)
    const response: RefreshApiResponse = {
      success: false,
      articleCount: 0,
      lastRefreshed: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
    return NextResponse.json(response, { status: 500 })
  }
}
