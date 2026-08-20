self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    /* ignore malformed payloads */
  }
  const title = data.title || 'Ephemera'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || String(Date.now()),
    renotify: Boolean(data.tag),
    vibrate: data.vibrate || [120, 60, 120],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const urlObj = new URL(url, self.location.origin)
      for (const client of windowClients) {
        if ('focus' in client) {
          const current = new URL(client.url, self.location.origin)
          if (current.pathname !== urlObj.pathname || current.search !== urlObj.search) {
            client.navigate(urlObj.href)
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlObj.href)
      }
    }),
  )
})