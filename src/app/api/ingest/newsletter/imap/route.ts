/**
 * POST /api/ingest/newsletter/imap
 *
 * Triggers an immediate IMAP poll cycle. Used by the "Fetch now" button in
 * Settings and called from /api/news/refresh when the poll interval has elapsed.
 *
 * Returns: { success, ingested, skipped } or { success: false, error }
 */

import { NextResponse } from 'next/server'
import { pollImap, isImapConfigured } from '@/lib/imap-poller'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (!isImapConfigured()) {
    return NextResponse.json(
      { success: false, error: 'IMAP not configured. Set IMAP_HOST, IMAP_USER, and IMAP_PASS.' },
      { status: 501 }
    )
  }

  try {
    const result = await pollImap()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[imap] Poll failed:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Poll failed' },
      { status: 500 }
    )
  }
}
