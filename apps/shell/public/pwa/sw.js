/* global clients */

const cacheName = '3tledger-offline-v1';
const offlinePage = '/pwa/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await cache.add(new Request(offlinePage, { cache: 'reload', credentials: 'omit' }));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith('3tledger-offline-') && key !== cacheName).map((key) => caches.delete(key)),
      );
      await clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (error) {
        const fallback = await caches.match(offlinePage, { cacheName });
        if (fallback) return fallback;
        throw error;
      }
    })(),
  );
});
