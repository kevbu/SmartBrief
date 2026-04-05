/**
 * POST /api/ingest/newsletter
 *
 * Inbound webhook for newsletter emails. Compatible with:
 *   - Mailgun Inbound Routes (sends parsed fields as multipart form-data or JSON)
 *   - SendGrid Inbound Parse (sends parsed fields as multipart form-data)
 *   - n8n / Zapier / Make actions (sends JSON body)
 *
 * Required env var: NEWSLETTER_INGEST_SECRET
 * If not set, the endpoint returns 501 (not configured).
 *
 * Authentication: pass the secret in the `X-Ingest-Secret` header OR as the
 * `secret` field in the JSON body. Header is preferred for webhook configs.
 *
 * Expected JSON body:
 * {
 *   "from":    "The Hustle <newsletter@hustle.com>",
 *   "subject": "Today's top stories",
 *   "html":    "<html>...</html>",   // preferred
 *   "text":    "plain text body",    // fallback if html absent
 *   "date":    "2026-04-04T08:00:00Z" // optional; defaults to now
 * }
 *
 * For Mailgun: set the route action to:
 *   forward("https://yourapp.com/api/ingest/newsletter")
 * and add your secret as a custom header in the webhook config, or
 * append it as ?secret=<token> in the URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseNewsletterEmail } from '@/lib/newsletter-parser'

export async function POST(request: NextRequest) {
  const secret = process.env.NEWSLETTER_INGEST_SECRET
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Newsletter ingestion is not configured. Set NEWSLETTER_INGEST_SECRET.' },
      { status: 501 }
    )
  }

  // Auth: header takes priority, then body field, then query param
  const headerSecret = request.headers.get('x-ingest-secret')
  const urlSecret = request.nextUrl.searchParams.get('secret')

  let body: Record<string, string> = {}
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      body = await request.json() as Record<string, string>
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }
  } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    try {
      const formData = await request.formData()
      formData.forEach((val, key) => {
        if (typeof val === 'string') body[key] = val
      })
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 })
    }
  }

  const providedSecret = headerSecret ?? urlSecret ?? body.secret
  if (providedSecret !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const from = body.from ?? body.sender ?? ''
  const subject = body.subject ?? body.Subject ?? '(No subject)'
  const html = body.html ?? body['body-html'] ?? body['stripped-html'] ?? undefined
  const text = body.text ?? body['body-plain'] ?? body['stripped-text'] ?? undefined
  const dateStr = body.date ?? body.Date ?? undefined

  if (!from) {
    return NextResponse.json({ success: false, error: '"from" field is required' }, { status: 400 })
  }
  if (!html && !text) {
    return NextResponse.json({ success: false, error: 'Either "html" or "text" body is required' }, { status: 400 })
  }

  const receivedAt = dateStr ? new Date(dateStr) : new Date()

  const parsed = parseNewsletterEmail({ from, subject, html, text, receivedAt })

  // Deduplicate by pseudo-URL (same newsletter forwarded twice won't create duplicates)
  const existing = await db.article.findUnique({ where: { url: parsed.url } })
  if (existing) {
    return NextResponse.json({ success: true, articleId: existing.id, duplicate: true })
  }

  const article = await db.article.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      content: parsed.content,
      url: parsed.url,
      imageUrl: null,
      publishedAt: parsed.publishedAt,
      source: parsed.source,
      sourceUrl: parsed.sourceUrl,
      category: parsed.category,
      sentiment: 'neutral',
      sentimentScore: 0,
    },
  })

  console.log(`[newsletter-ingest] Stored article ${article.id} from "${parsed.source}": ${parsed.title}`)

  return NextResponse.json({ success: true, articleId: article.id })
}
