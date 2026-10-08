// Service worker: shows push notifications from the school (e.g. an
// unread private message) even when the website is closed, and opens the
// right page when one is tapped. It deliberately caches nothing.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text push */ }
  const title = data.title || 'Citadel of Highflyers';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'You have a new notification.',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    tag: data.tag || 'citadel',
    data: { url: data.url || '/portal/messages' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/portal/messages';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { await c.focus(); if ('navigate' in c) c.navigate(target); return; }
    }
    await self.clients.openWindow(target);
  })());
});
