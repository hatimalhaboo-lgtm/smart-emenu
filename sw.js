// Smart Restaurant POS — Safe Cashier & Menu Service Worker
const CACHE_NAME = 'emenu-cache-v23';

const ASSETS = [
  './',
  './cashier.html',
  './captain.html',
  './admin.html',
  './super-admin.html',
  './index.html',
  './logo.svg',
  './styles.css',
  './auth-core.js',
  './bundle-cashier.js',
  './bundle-captain.js',
  './bundle-admin.js',
  './manifest.json',
  './cashier-manifest.json',
  './captain-manifest.json',
  './admin-manifest.json',
  './super-admin-manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((url) => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => {
        if (k !== CACHE_NAME) return caches.delete(k);
      })
    )).then(() => self.clients.claim())
  );
});

// Network-first strategy; NEVER intercept or cache Supabase database calls
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('chrome-extension')) return;

  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type !== 'opaque') {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkRes;
      })
      .catch(() => caches.match(e.request))
  );
});
