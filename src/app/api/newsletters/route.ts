import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = 20
    const source = searchParams.get('source') || undefined

    const baseWhere = { url: { startsWith: 'newsletter://' } }
    const where = { ...baseWhere, ...(source ? { source } : {}) }

    const [newsletters, total, unreadCount] = await Promise.all([
      db.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.article.count({ where }),
      db.article.count({ where: { ...baseWhere, isRead: false } }),
    ])

    return NextResponse.json({
      newsletters: newsletters.map((a: typeof newsletters[number]) => ({
        ...a,
        sentiment: a.sentiment as 'positive' | 'neutral' | 'negative',
      })),
      unreadCount,
      total,
    })
  } catch (err) {
    console.error('GET /api/newsletters error:', err)
    return NextResponse.json({ error: 'Failed to fetch newsletters' }, { status: 500 })
  }
}
