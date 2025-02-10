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
  // Add any additional asset paths as needed.
];

/**
 * If a response is flagged as redirected, create a new Response from its body
 * so that the "redirected" flag is cleared.
 */
function fixRedirectedResponse(response) {
  if (response.redirected) {
    console.log('[Service Worker] Fixing redirected response for:', response.url);
    return response.blob().then(blob => {
      const newHeaders = new Headers(response.headers);
      newHeaders.delete('location'); // Remove any redirect header.
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
 * For non-navigation requests, fetch with the default redirect behavior.
 */
function fetchAndFix(request) {
  return fetch(request, { redirect: 'follow' })
    .then(response => fixRedirectedResponse(response));
}

/**
 * For navigation requests (full-page loads), handle redirects manually.
 * We first fetch with redirect: 'manual'. If the response is redirected,
 * we then fetch the final URL with redirect: 'follow' so that the returned
 * response does not have redirected: true.
 */
function handleNavigationRequest(request) {
  return fetch(request, { redirect: 'manual' })
    .then(response => {
      if (response.redirected || response.type === 'opaqueredirect') {
        console.log('[Service Worker] Navigation request was redirected. Final URL:', response.url);
        // Manually follow the redirect by fetching the final URL.
        return fetch(response.url, { redirect: 'follow' })
          .then(r => fixRedirectedResponse(r));
      }
      return fixRedirectedResponse(response);
    });
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

// Activation: Clean up old caches.
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

// Fetch: Handle navigation and non-navigation requests.
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    // For navigation requests, handle redirects manually.
    event.respondWith(
      handleNavigationRequest(event.request)
        .catch(error => {
          console.error('[Service Worker] Navigation fetch failed:', event.request.url, error);
          return caches.match('index.html');
        })
    );
    return;
  }

  // For non-navigation requests, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return fixRedirectedResponse(cachedResponse);
        }
        return fetchAndFix(event.request)
          .then(networkResponse => {
            // Only cache successful responses.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }
            // Clone the response for caching.
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
