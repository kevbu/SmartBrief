import { NextResponse } from 'next/server'
import { refreshNews } from '@/lib/news-aggregator'
import { pollImap, isImapPollDue } from '@/lib/imap-poller'
import { detectAndPush, isDetectDue } from '@/lib/breaking-news-detector'
import type { RefreshApiResponse } from '@/types'

export async function POST() {
  try {
    const { articleCount, lastRefreshed } = await refreshNews()

    // Piggyback IMAP poll when the configured interval has elapsed.
    // Runs fire-and-forget style so a slow/failing IMAP server doesn't
    // block the RSS response. Errors are logged but not surfaced to the client.
    if (await isImapPollDue()) {
      pollImap().catch((err) => console.error('[refresh] IMAP poll error:', err))
    }

    // Piggyback breaking-news detection at its own 5-minute cadence.
    if (await isDetectDue()) {
      detectAndPush().catch((err) => console.error('[refresh] Breaking-news detect error:', err))
    }

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
