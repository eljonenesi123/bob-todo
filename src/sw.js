/* Bob service worker: offline support now, push notifications in step 6 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.skipWaiting()
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Open the app instantly from cache, even with no signal
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
