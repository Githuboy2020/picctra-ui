const CACHE_NAME = 'picctra-cache-v1';
const urlsToCache = [
  'index.html',
  'tool.html',
  'upload.html',
  'results.html',
  'subscription.html',
  'styles.css',
  'manifest.json',
  'picctra-logo.png',
  'press/hero-bg.jpg'
  // Add any additional files or asset paths as needed.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
