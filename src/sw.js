/* Bob service worker: offline support + push notifications */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.skipWaiting()
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Open the app instantly from cache, even with no signal
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// A nudge arrives from the server
self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const jobs = [
    self.registration.showNotification(data.title || 'Bob', {
      body: data.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: data.tag || 'bob',
      renotify: true,
      data: { url: data.url || './' },
    }),
  ]

  // Red number on the app icon = tasks left
  if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
    jobs.push(data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge())
  }

  event.waitUntil(Promise.all(jobs).catch(() => {}))
})

// Tapping a notification opens (or focuses) Bob
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of windows) {
      if (w.url.startsWith(self.registration.scope)) return w.focus()
    }
    return self.clients.openWindow(url)
  })())
})
