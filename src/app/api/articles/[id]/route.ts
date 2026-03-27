import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const article = await db.article.findUnique({ where: { id } })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    let bullets: string[] = []

    if (article.aiBullets) {
      try {
        bullets = JSON.parse(article.aiBullets) as string[]
      } catch {
        bullets = []
      }
    } else if (process.env.ANTHROPIC_API_KEY) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const content = [
          article.title,
          article.description,
          article.content,
        ]
          .filter(Boolean)
          .join('\n\n')

        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: `Generate exactly 3-5 concise bullet points summarizing this news article. Each bullet should be one sentence, factual, and informative. Return ONLY a JSON array of strings, no other text.\n\n${content}`,
            },
          ],
        })

        const text =
          response.content[0].type === 'text' ? response.content[0].text : ''
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          bullets = JSON.parse(jsonMatch[0]) as string[]
          await db.article.update({
            where: { id },
            data: { aiBullets: JSON.stringify(bullets) },
          })
        }
      } catch (err) {
        console.error('Error generating bullets:', err)
        bullets = []
      }
    }

    // Handle topStoryId query param
    const topStoryId = request.nextUrl.searchParams.get('topStoryId')
    let topStoryArticleIds: string[] | undefined
    if (topStoryId) {
      const topStory = await db.topStory.findUnique({ where: { id: topStoryId } })
      if (topStory) {
        try {
          topStoryArticleIds = JSON.parse(topStory.articleIds) as string[]
        } catch {
          topStoryArticleIds = []
        }
      }
    }

    return NextResponse.json({
      ...article,
      bullets,
      ...(topStoryArticleIds !== undefined ? { topStoryArticleIds } : {}),
    })
  } catch (err) {
    console.error('Error fetching article:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
