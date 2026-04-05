/**
 * Push notification dispatcher.
 *
 * Sends a Web Push notification to the stored PushSubscription (if any),
 * subject to the user's quiet-hours preference. Quiet-hours enforcement is
 * server-side: if the current local server time falls within the quiet window,
 * the push is silently skipped and the caller should retry later.
 */

import webpush from 'web-push'
import { db } from './db'
import { getOrCreateVapidKeys } from './push-vapid'

export interface PushPayload {
  title: string
  body: string
  storyId: string
  url: string
}

/**
 * Returns true if the current time (UTC hours expressed as HH:MM) falls within
 * the quiet window [start, end). Handles overnight windows like 22:00–07:00.
 */
function isQuietHours(start: string, end: string): boolean {
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em

  if (startMins < endMins) {
    // Same-day window e.g. 09:00–12:00
    return nowMins >= startMins && nowMins < endMins
  } else {
    // Overnight window e.g. 22:00–07:00
    return nowMins >= startMins || nowMins < endMins
  }
}

export async function dispatch(payload: PushPayload): Promise<'sent' | 'quiet' | 'no-subscription'> {
  // Check quiet hours
  const prefs = await db.userPreferences.findUnique({ where: { id: 'default' } })
  if (prefs?.quietHoursEnabled && prefs.quietHoursStart && prefs.quietHoursEnd) {
    if (isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)) {
      console.log('[push-dispatcher] Quiet hours active — skipping push')
      return 'quiet'
    }
  }

  const subscription = await db.pushSubscription.findFirst()
  if (!subscription) {
    return 'no-subscription'
  }

  const vapid = await getOrCreateVapidKeys()
  webpush.setVapidDetails(
    'mailto:smartbrief@localhost',
    vapid.publicKey,
    vapid.privateKey,
  )

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }

  await webpush.sendNotification(pushSubscription, JSON.stringify(payload))
  console.log(`[push-dispatcher] Sent push for story ${payload.storyId}`)
  return 'sent'
}
