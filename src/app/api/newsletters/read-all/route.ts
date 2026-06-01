import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const result = await db.article.updateMany({
      where: { url: { startsWith: 'newsletter://' }, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return NextResponse.json({ success: true, updated: result.count })
  } catch (err) {
    console.error('POST /api/newsletters/read-all error:', err)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}
