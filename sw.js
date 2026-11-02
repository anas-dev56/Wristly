/* WRISTLY service worker — offline caching (PWA).
   Strategy: stale-while-revalidate for the page (instant repeat visits,
   fresh copy picked up in the background), cache-first for static assets.
   Bump CACHE_VERSION whenever index.html changes, so visitors get the update. */
const CACHE_VERSION = 'wristly-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './assets/manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) =>
        // Tolerant precache: a missing file (e.g. icons not uploaded yet)
        // must not fail the whole install; it gets cached on first fetch.
        Promise.all(CORE_ASSETS.map((url) => cache.add(url).catch(() => {})))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // only our own files

  const isPage = url.pathname === '/' ||
                 url.pathname.endsWith('/index.html') ||
                 url.pathname.endsWith('/');

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return res;
      }).catch(() => cached || caches.match('./index.html'));

      // Page: serve cache instantly, refresh in background.
      // Assets: serve cache, fall back to network.
      return isPage ? (cached || network) : (cached || network);
    })
  );
});
