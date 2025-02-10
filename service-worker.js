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
  // Add additional asset paths as needed.
];

/**
 * Fix a response that has been flagged as redirected.
 * This reads the response body as a blob and creates a new Response
 * with the same status, statusText, and headers but without the "redirected" flag.
 */
function fixRedirectedResponse(response) {
  if (response.redirected) {
    console.log('[Service Worker] Fixing redirected response for:', response.url);
    return response.blob().then(blob => {
      // Create new headers from the original response.
      const newHeaders = new Headers(response.headers);
      // Remove the 'location' header (if present) so that the new response doesn't hint at a redirect.
      newHeaders.delete('location');
      // Return a new Response constructed from the blob and new headers.
      return new Response(blob, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    });
  }
  return Promise.resolve(response);
}

/**
 * A helper function that performs a fetch with redirect: 'follow' and fixes any redirected response.
 */
function fetchAndFix(request) {
  return fetch(request, { redirect: 'follow' })
    .then(response => fixRedirectedResponse(response));
}

// Installation: Cache essential assets.
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

// Activation: Clean up any old caches.
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

// Fetch: Use a cache-first strategy for non-navigation requests,
// and for navigation requests, use a network-first strategy with redirect fixing.
self.addEventListener('fetch', event => {
  // For navigation requests (full-page loads like tool.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetchAndFix(event.request)
        .catch(error => {
          console.error('[Service Worker] Navigation fetch failed:', event.request.url, error);
          return caches.match('index.html');
        })
    );
    return;
  }
  
  // For non-navigation requests (assets, images, CSS, etc.), use cache-first.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return fixRedirectedResponse(cachedResponse);
        }
        return fetchAndFix(event.request)
          .then(networkResponse => {
            // Only cache valid responses.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }
            // Clone the response so that one copy is cached and the other is returned.
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });
            return networkResponse;
          })
          .catch(error => {
            console.error('[Service Worker] Fetch failed for:', event.request.url, error);
            throw error;
          });
      })
  );
});
