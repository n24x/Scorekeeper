// APA Scorekeeper Service Worker
// Network-first for the app shell and code (so a new deploy shows up on the
// first reload), cache-first for icons. Everything still works offline.
const CACHE_NAME = 'apa-scorekeeper-v1.5';
const APP_URLS = [
  './',
  './index.html',
  './manifest.json',
  './js/scoring.js',
  './js/summary.js',
  './js/db.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Install: pre-cache core resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_URLS.map(url => cache.add(url).catch(() => {}))
      ).then(() => self.skipWaiting());
    })
  );
});

// Activate: drop every older cache and take over open pages
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave third-party alone

  // App shell + code: try the network first so updates land immediately.
  if (req.mode === 'navigate' || req.destination === 'script' ||
      req.destination === 'style' || req.destination === 'worker') {
    event.respondWith(
      fetch(req).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return response;
      }).catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Icons and other static assets: cache first, then network.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return response;
      }).catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});
