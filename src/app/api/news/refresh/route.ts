import { NextResponse } from 'next/server'
import { refreshNews } from '@/lib/news-aggregator'
import type { RefreshApiResponse } from '@/types'

export async function POST() {
  try {
    const { articleCount, lastRefreshed } = await refreshNews()

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
