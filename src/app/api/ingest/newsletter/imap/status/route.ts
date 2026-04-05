/**
 * GET /api/ingest/newsletter/imap/status
 *
 * Returns IMAP configuration state for the Settings UI. Credentials are
 * never returned to the client — only masked metadata.
 *
 * Response:
 * {
 *   configured: boolean
 *   host?: string          // masked, e.g. "imap.gmail.com"
 *   user?: string          // masked, e.g. "you@..."
 *   folder?: string
 *   pollIntervalMins?: number
 *   lastPoll?: string      // ISO timestamp or null
 *   newsletterCount?: number
 * }
 */

import { NextResponse } from 'next/server'
import { isImapConfigured, getImapConfig } from '@/lib/imap-poller'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isImapConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const cfg = getImapConfig()

  const [state, newsletterCount] = await Promise.all([
    db.appState.findUnique({ where: { id: 'default' } }),
    db.article.count({ where: { url: { startsWith: 'newsletter://' } } }),
  ])

  // Mask the username: show first part up to '@' abbreviated
  const userParts = cfg.user.split('@')
  const maskedUser = userParts[0].length > 3
    ? `${userParts[0].slice(0, 3)}…@${userParts[1] ?? ''}`
    : cfg.user

  return NextResponse.json({
    configured: true,
    host: cfg.host,
    user: maskedUser,
    folder: cfg.folder,
    pollIntervalMins: cfg.pollIntervalMins,
    lastPoll: state?.lastImapPoll?.toISOString() ?? null,
    newsletterCount,
  })
}
