import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { ArticleActionResponse } from '@/types'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const existing = await db.article.findUnique({ where: { id } })
    if (!existing || !existing.url.startsWith('newsletter://')) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    // Idempotent — skip write if already read
    if (existing.isRead) {
      const response: ArticleActionResponse = {
        success: true,
        article: { ...existing, sentiment: existing.sentiment as 'positive' | 'neutral' | 'negative' },
      }
      return NextResponse.json(response)
    }

    const article = await db.article.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })

    const response: ArticleActionResponse = {
      success: true,
      article: { ...article, sentiment: article.sentiment as 'positive' | 'neutral' | 'negative' },
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error(`Error marking newsletter ${id} as read:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
