// public/sw.js
// Service Worker do OnWay Condomínio — recebe push notifications.

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { titulo: event.data?.text() || 'OnWay Condomínio' }
  }

  const titulo = payload.titulo || 'OnWay Condomínio'
  const options = {
    body: payload.corpo || '',
    icon: payload.icon || '/favicon.svg',
    badge: payload.badge || '/favicon.svg',
    tag: payload.tag || 'onway-' + Date.now(),
    data: { link: payload.link || '/' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(titulo, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/'
  const url = new URL(link, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já tem uma janela aberta, foca nela e navega
      for (const client of windowClients) {
        if ('focus' in client && 'navigate' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Senão, abre nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    }),
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
