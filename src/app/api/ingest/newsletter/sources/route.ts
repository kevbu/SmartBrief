import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/ingest/newsletter/sources
 *
 * Returns the distinct newsletter sources that have been ingested (identified
 * by articles whose URL starts with the 'newsletter://' pseudo-scheme set by
 * the newsletter parser). Includes per-source article count and whether the
 * source is currently hidden in the feed.
 */
export async function GET() {
  try {
    const [rows, prefs] = await Promise.all([
      db.$queryRaw<Array<{ source: string; count: bigint }>>`
        SELECT source, COUNT(*) as count
        FROM Article
        WHERE url LIKE 'newsletter://%'
        GROUP BY source
        ORDER BY source ASC
      `,
      db.userPreferences.findUnique({
        where: { id: 'default' },
        select: { hiddenSources: true },
      }),
    ])

    const hiddenSet = new Set(
      (prefs?.hiddenSources ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )

    const sources = rows.map((r) => ({
      name: r.source,
      count: Number(r.count),
      enabled: !hiddenSet.has(r.source.toLowerCase()),
    }))

    return NextResponse.json({ sources })
  } catch (err) {
    console.error('Error fetching newsletter sources:', err)
    return NextResponse.json({ error: 'Failed to fetch newsletter sources' }, { status: 500 })
  }
}
