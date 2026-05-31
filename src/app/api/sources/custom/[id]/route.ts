import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const existing = await db.customSource.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ success: false, error: 'Source not found' }, { status: 404 })

  await db.customSource.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
