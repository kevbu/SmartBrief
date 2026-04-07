import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/recap/viewed
 * Logs a recap_viewed event for the weekly usage metric.
 * Called fire-and-forget from the recap page on mount.
 */
export async function POST() {
  try {
    await db.appEvent.create({ data: { action: 'recap_viewed' } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error logging recap_viewed:', err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
