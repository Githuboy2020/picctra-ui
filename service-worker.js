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
  // Add any additional assets as needed.
];

/**
 * If a response was redirected, this function creates a new Response 
 * with the same body, status, statusText, and headers—but not marked as redirected.
 */
function fixRedirectedResponse(response) {
  if (response.redirected) {
    return response.blob().then(blob => {
      const newHeaders = new Headers(response.headers);
      // Optionally, remove the 'location' header if it exists.
      newHeaders.delete('location');
      return new Response(blob, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    });
  }
  return Promise.resolve(response);
}

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

// Activation: delete any old caches.
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

// Fetch: use different strategies for navigation requests versus other assets.
self.addEventListener('fetch', event => {
  // For navigation requests (e.g., full HTML pages like tool.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { redirect: 'follow' })
        .then(response => fixRedirectedResponse(response))
        .catch(error => {
          console.error('[Service Worker] Navigation fetch failed:', event.request.url, error);
          return caches.match('index.html');
        })
    );
    return;
  }

  // For non-navigation requests (assets, images, CSS, etc.), use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // If the cached response was redirected, fix it before returning.
          return fixRedirectedResponse(cachedResponse);
        }
        return fetch(event.request, { redirect: 'follow' })
          .then(networkResponse => {
            return fixRedirectedResponse(networkResponse).then(fixedResponse => {
              // Only cache valid responses.
              if (!fixedResponse || fixedResponse.status !== 200 || fixedResponse.type === 'opaque') {
                return fixedResponse;
              }
              // Clone the fixed response so we can add one copy to the cache.
              const responseClone = fixedResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });
              return fixedResponse;
            });
          })
          .catch(error => {
            console.error('[Service Worker] Fetch failed for:', event.request.url, error);
            throw error;
          });
      })
  );
});
