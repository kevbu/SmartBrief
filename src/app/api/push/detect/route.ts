import { NextResponse } from 'next/server'
import { detectAndPush } from '@/lib/breaking-news-detector'

export const dynamic = 'force-dynamic'

/**
 * GET /api/push/detect
 *
 * Runs the breaking-news detection cycle. Intended to be called every 5 minutes
 * by the service worker (when the app is open) and piggybacked on news refreshes.
 * Safe to call more frequently — isDetectDue() guards over-execution.
 */
export async function GET() {
  try {
    const result = await detectAndPush()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[push/detect] Error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
