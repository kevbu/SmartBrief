import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const logs = await db.notificationLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({ logs })
  } catch (err) {
    console.error('Error fetching notification history:', err)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
