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
  // Add additional assets as needed.
];

// Installation: cache essential assets.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching files:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Error during cache installation:', error);
      })
  );
});

// Activation: remove old caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch: differentiate between navigation and other requests.
self.addEventListener('fetch', event => {
  // For navigation requests (e.g., loading a page like tool.html),
  // bypass the custom caching strategy to avoid redirect issues.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.error('[Service Worker] Navigation fetch failed:', event.request.url, error);
          return caches.match('index.html');
        })
    );
    return;
  }
  
  // For other requests (assets, images, CSS, etc.), use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[Service Worker] Serving from cache:', event.request.url);
          return cachedResponse;
        }
        return fetch(event.request)
          .then(networkResponse => {
            // Check if the response is valid.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }
            // Clone the response before caching it.
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });
            return networkResponse;
          })
          .catch(error => {
            console.error('[Service Worker] Fetch failed:', event.request.url, error);
            throw error;
          });
      })
  );
});
