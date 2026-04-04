import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const count = await db.sourceWeight.count({
      where: { weight: { not: 1.0 } },
    })
    return NextResponse.json({ activeWeights: count })
  } catch (err) {
    console.error('Error fetching personalisation status:', err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await db.sourceWeight.deleteMany()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error resetting personalisation:', err)
    return NextResponse.json({ error: 'Failed to reset personalisation' }, { status: 500 })
  }
}
