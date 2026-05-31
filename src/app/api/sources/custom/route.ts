import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import Parser from 'rss-parser'

const parser = new Parser({ timeout: 10000 })

export async function GET() {
  const sources = await db.customSource.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ success: true, sources })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })

  const { name, url, category, logoEmoji } = body as {
    name?: string
    url?: string
    category?: string
    logoEmoji?: string
  }

  if (!name?.trim()) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
  if (!url?.trim()) return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 })

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url.trim())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 })
  }

  try {
    await parser.parseURL(parsedUrl.toString())
  } catch {
    return NextResponse.json({ success: false, error: 'Could not fetch or parse this RSS feed. Please check the URL.' }, { status: 400 })
  }

  const existing = await db.customSource.findUnique({ where: { url: parsedUrl.toString() } })
  if (existing) return NextResponse.json({ success: false, error: 'This feed URL is already added' }, { status: 409 })

  const source = await db.customSource.create({
    data: {
      name: name.trim(),
      url: parsedUrl.toString(),
      category: category ?? 'technology',
      logoEmoji: logoEmoji ?? '📰',
    },
  })

  return NextResponse.json({ success: true, source }, { status: 201 })
}
