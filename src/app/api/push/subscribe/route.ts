import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface SubscribeBody {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SubscribeBody

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 })
    }

    await db.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      update: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe] POST error:', err)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { endpoint?: string }

    if (body.endpoint) {
      await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint } })
    } else {
      // Remove all subscriptions (user toggled off globally)
      await db.pushSubscription.deleteMany({})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
}
