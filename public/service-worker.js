const CACHE_NAME = 'mv-shell-v4';
const SHELL_ASSETS = ['/', '/style.css', '/main.js', '/manifest.webmanifest'];

// No skipWaiting() on install: a new version waits until the visitor taps
// "Actualizar" in the update notice (index.html), so a page never ends up
// running old JS against a new worker mid-session.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin GETs only. Cross-origin requests (Supabase,
// DeepL, fonts…) and /api/ are never cached here — they can carry private,
// per-user data. Unhashed files (/main.js, /style.css, HTML) revalidate with
// the server instead of trusting the browser's HTTP cache, which is what let
// stale main.js survive deploys before.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const hashed = url.pathname.startsWith('/assets/');
  const network = hashed ? fetch(req) : fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });

  event.respondWith(
    network
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/') : undefined))
      )
  );
});
