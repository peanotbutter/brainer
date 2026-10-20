// Service worker: keeps a copy of the app on the phone so it opens
// without internet. (Your lessons and progress are in the database,
// which already works offline.)
//
// - The page itself: try the internet first (to get updates), and fall
//   back to the saved copy when offline.
// - Everything else (code, styles, fonts, icons): use the saved copy,
//   and save anything new the first time it is downloaded.

const CACHE = 'brainer-v1';

// On install, save the page plus every file it links to.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('./', { cache: 'no-store' });
      const html = await res.clone().text();
      await cache.put('./', res);
      const files = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((url) => !url.startsWith('http') || url.includes('fonts.googleapis.com'));
      await Promise.all(
        [...files, 'manifest.webmanifest', 'icon-192.png'].map((url) =>
          cache.add(url).catch(() => {}),
        ),
      );
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove caches from older versions of this file.
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  if (req.mode === 'navigate') {
    // The page: internet first, saved copy when offline.
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put('./', res.clone());
          return res;
        } catch {
          return (await cache.match('./')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Files: saved copy first, otherwise download and save.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })(),
  );
});
