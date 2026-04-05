import { NextResponse } from 'next/server'
import { getOrCreateVapidKeys } from '@/lib/push-vapid'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { publicKey } = await getOrCreateVapidKeys()
    return NextResponse.json({ publicKey })
  } catch (err) {
    console.error('[push/vapid-public] Error:', err)
    return NextResponse.json({ error: 'Failed to get VAPID public key' }, { status: 500 })
  }
}
