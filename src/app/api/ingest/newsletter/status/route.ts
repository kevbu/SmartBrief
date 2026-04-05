/**
 * GET /api/ingest/newsletter/status
 *
 * Returns whether newsletter ingestion is configured and, if so, the webhook
 * URL to display in the settings UI. The secret itself is never sent to the
 * client — only whether it exists.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const configured = !!process.env.NEWSLETTER_INGEST_SECRET

  if (!configured) {
    return NextResponse.json({ configured: false })
  }

  // Build the webhook URL from the incoming request origin so it works
  // regardless of whether the app is behind a reverse proxy.
  const { protocol, host } = request.nextUrl
  const webhookUrl = `${protocol}//${host}/api/ingest/newsletter`

  return NextResponse.json({ configured: true, webhookUrl })
}
