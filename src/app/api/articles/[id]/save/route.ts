import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { ArticleActionResponse } from '@/types'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await db.article.findUnique({ where: { id: params.id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      )
    }

    const article = await db.article.update({
      where: { id: params.id },
      data: { isSaved: !existing.isSaved },
    })

    const response: ArticleActionResponse = {
      success: true,
      article: {
        ...article,
        sentiment: article.sentiment as 'positive' | 'neutral' | 'negative',
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error(`Error toggling save for article ${params.id}:`, err)
    const response: ArticleActionResponse = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
    return NextResponse.json(response, { status: 500 })
  }
}
