import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const CATCH_UP_THRESHOLD_HOURS = 24

export async function POST() {
  try {
    const now = new Date()

    // Read current lastOpenedAt, then immediately write now
    const current = await db.appState.findUnique({ where: { id: 'default' } })
    const previousOpenedAt = current?.lastOpenedAt ?? null

    await db.appState.upsert({
      where: { id: 'default' },
      update: { lastOpenedAt: now },
      create: { id: 'default', lastOpenedAt: now },
    })

    const gapHours = previousOpenedAt
      ? (now.getTime() - previousOpenedAt.getTime()) / (1000 * 60 * 60)
      : 0

    const catchUpMode = gapHours > CATCH_UP_THRESHOLD_HOURS

    return NextResponse.json({
      previousOpenedAt: previousOpenedAt?.toISOString() ?? null,
      gapHours: Math.round(gapHours),
      catchUpMode,
    })
  } catch (err) {
    console.error('Error in POST /api/session/open:', err)
    return NextResponse.json({ error: 'Session open failed' }, { status: 500 })
  }
}
