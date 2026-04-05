/**
 * POST /api/ingest/newsletter/imap/test
 *
 * Verifies IMAP credentials and folder existence without ingesting anything.
 * Responds within the 15s connection timeout.
 */

import { NextResponse } from 'next/server'
import { testImapConnection, isImapConfigured } from '@/lib/imap-poller'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (!isImapConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'IMAP not configured. Set IMAP_HOST, IMAP_USER, and IMAP_PASS.' },
      { status: 501 }
    )
  }

  const result = await testImapConnection()
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
