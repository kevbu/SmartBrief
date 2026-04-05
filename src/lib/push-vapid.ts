/**
 * VAPID key management.
 *
 * On first call, generates an EC P-256 VAPID key pair and persists both keys
 * in the AppState row so they survive Docker restarts. Subsequent calls return
 * the cached pair from the DB.
 */

import webpush from 'web-push'
import { db } from './db'

export interface VapidKeys {
  publicKey: string
  privateKey: string
}

export async function getOrCreateVapidKeys(): Promise<VapidKeys> {
  const state = await db.appState.findUnique({ where: { id: 'default' } })

  if (state?.vapidPublic && state?.vapidPrivate) {
    return { publicKey: state.vapidPublic, privateKey: state.vapidPrivate }
  }

  const keys = webpush.generateVAPIDKeys()

  await db.appState.upsert({
    where: { id: 'default' },
    create: { id: 'default', vapidPublic: keys.publicKey, vapidPrivate: keys.privateKey },
    update: { vapidPublic: keys.publicKey, vapidPrivate: keys.privateKey },
  })

  console.log('[push-vapid] Generated new VAPID key pair')
  return keys
}
