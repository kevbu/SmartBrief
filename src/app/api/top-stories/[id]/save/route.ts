import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const story = await db.topStory.findUnique({
      where: { id: params.id },
      select: { saved: true },
    })

    if (!story) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const updated = await db.topStory.update({
      where: { id: params.id },
      data: { saved: !story.saved },
      select: { saved: true },
    })

    return NextResponse.json({ success: true, saved: updated.saved })
  } catch (err) {
    console.error(`Error toggling save for top story ${params.id}:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
