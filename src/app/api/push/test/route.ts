import { NextResponse } from 'next/server'
import { dispatch } from '@/lib/push-dispatcher'

/**
 * POST /api/push/test
 * Sends a test push notification through the real dispatch path.
 * Used by the QA checklist and the push settings UI to verify the
 * full Web Push stack (VAPID keys, subscription endpoint, browser receipt).
 */
export async function POST() {
  try {
    const result = await dispatch({
      title: '✅ SmartBrief test',
      body: 'Push notifications are working correctly.',
      storyId: 'test',
      url: '/',
    })

    if (result === 'no-subscription') {
      return NextResponse.json(
        { ok: false, error: 'No push subscription found. Enable push notifications in Settings first.' },
        { status: 400 }
      )
    }

    if (result === 'quiet') {
      return NextResponse.json(
        { ok: false, error: 'Quiet hours are active — test skipped. Disable quiet hours temporarily to test.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[push/test] Failed:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
