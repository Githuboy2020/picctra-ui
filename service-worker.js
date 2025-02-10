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

// Install event: cache essential assets.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching files:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Error during caching files:', error);
      })
  );
});

// Activate event: clean up any old caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
});

// Fetch event: try cache first, then network.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if available.
        if (cachedResponse) {
          console.log('[Service Worker] Serving from cache:', event.request.url);
          return cachedResponse;
        }
        // Otherwise, fetch from network with redirect mode set to 'follow'.
        return fetch(event.request, { redirect: 'follow' })
          .then(networkResponse => {
            // Log a warning if a redirected response is encountered.
            if (networkResponse.redirected && event.request.redirect !== 'follow') {
              console.warn(`[Service Worker] Warning: Redirected response for ${event.request.url}`);
            }
            // Optionally, cache the network response for future visits.
            return caches.open(CACHE_NAME).then(cache => {
              // Clone the response stream so that both the cache and the browser receive a copy.
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
          .catch(error => {
            console.error('[Service Worker] Fetch failed for:', event.request.url, error);
            // Optionally, you could return a fallback response here.
            throw error;
          });
      })
  );
});
