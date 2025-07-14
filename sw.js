const CACHE_NAME = 'lip-sync-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/MBP.svg',
  '/E.svg',
  '/O.svg',
  '/A.svg',
  '/FV.svg',
  '/TS.svg',
  '/LN.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});