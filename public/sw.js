// Self-unregistering service worker — replaces the previous caching SW.
// When this loads, it wipes itself and all caches so the page serves fresh code.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
      self.registration.unregister(),
    ]).then(() => self.clients.matchAll().then((clients) => {
      clients.forEach((c) => c.navigate(c.url));
    }))
  );
});
