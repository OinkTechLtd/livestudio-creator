const CACHE_NAME = 'streamlivetv-v3';

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clear old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete all old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - Network only for WebView compatibility
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // For WebView: Always use network, never cache HTML/API
  const url = new URL(request.url);
  
  // Never cache HTML pages or API calls
  if (
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('supabase') ||
    url.pathname.includes('functions')
  ) {
    event.respondWith(
      fetch(request, {
        cache: 'no-store',
        headers: {
          ...Object.fromEntries(request.headers),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }).catch(() => caches.match(request))
    );
    return;
  }

  // For static assets: Network first with minimal caching
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        // Only cache truly static assets (fonts, images)
        if (response.ok && (
          request.url.includes('/fonts/') ||
          request.url.match(/\.(woff2?|ttf|otf|eot|ico|png|jpg|jpeg|gif|svg)$/)
        )) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
