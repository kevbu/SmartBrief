// SmartBrief Service Worker
// Handles push events and notification clicks for critical breaking news alerts.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'SmartBrief', body: event.data.text(), storyId: 'unknown', url: '/' }
  }

  const { title, body, storyId, url } = payload

  const options = {
    body: body || 'Critical breaking news detected.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: storyId,           // device-level dedup: replaces any prior notification for the same story
    renotify: false,
    requireInteraction: true,
    data: { url: url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title || 'SmartBrief', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

// Poll for breaking news every 5 minutes when the SW is active
// (covers the case where the app tab is open but idle)
let detectInterval = null

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
  if (detectInterval) clearInterval(detectInterval)
  detectInterval = setInterval(() => {
    fetch('/api/push/detect').catch(() => {})
  }, 5 * 60 * 1000)
})
