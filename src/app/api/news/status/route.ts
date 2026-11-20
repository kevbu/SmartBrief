import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Cheap freshness probe for the client: lets a resumed app decide whether the
// full /api/news read is worth doing (a scheduled refresh may have run meanwhile).
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const appState = await db.appState.findUnique({ where: { id: 'default' } })
    return NextResponse.json(
      { lastRefreshed: appState?.lastRefreshed?.toISOString() ?? null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('Error reading news status:', err)
    return NextResponse.json({ lastRefreshed: null, error: 'status unavailable' }, { status: 500 })
  }
}
