const CACHE_VERSION = 'criativa-pwa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg'];

const isApiRequest = (url) => url.pathname.startsWith('/api/');
const isStaticAsset = (request, url) =>
  request.method === 'GET' &&
  url.origin === self.location.origin &&
  !isApiRequest(url) &&
  ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin || isApiRequest(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  if (!isStaticAsset(request, url)) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
