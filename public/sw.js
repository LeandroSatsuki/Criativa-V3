const CACHE_PREFIX = 'criativa-pwa-';
const serviceWorkerUrl = new URL(self.location.href);
const CACHE_VERSION = (serviceWorkerUrl.searchParams.get('app-version') || 'v2')
  .replace(/[^a-zA-Z0-9._-]/g, '-')
  .slice(0, 80);
const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}-static`;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const isSensitiveRequestPath = (pathname) =>
  pathname === '/api' ||
  pathname.startsWith('/api/') ||
  pathname === '/.netlify/functions' ||
  pathname.startsWith('/.netlify/functions/');

const isCacheableStaticRequest = (request, url) =>
  request.method === 'GET' &&
  url.origin === self.location.origin &&
  !isSensitiveRequestPath(url.pathname) &&
  (url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest');

const discoverShellAssets = (html) => {
  const assets = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;

  for (const match of html.matchAll(attributePattern)) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
      assets.add(`${url.pathname}${url.search}`);
    }
  }

  return [...assets];
};

const cacheAppShell = async () => {
  const cache = await caches.open(STATIC_CACHE);
  const shellResponse = await fetch(new Request('/', { cache: 'reload' }));

  if (!shellResponse.ok) {
    throw new Error(`Nao foi possivel preparar o app shell: HTTP ${shellResponse.status}`);
  }

  const shellAssets = discoverShellAssets(await shellResponse.clone().text());
  await cache.addAll([...new Set([...APP_SHELL.slice(1), ...shellAssets])]);
  await cache.put('/', shellResponse);
};

const serveCachedAppShell = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cachedShell = await cache.match('/');

  if (cachedShell) return cachedShell;
  return fetch(request);
};

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  // A nova versao espera as telas abertas fecharem para nao interromper visitas.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    isSensitiveRequestPath(url.pathname)
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    const navigationResponse = serveCachedAppShell(request);
    event.respondWith(navigationResponse);
    event.waitUntil(
      navigationResponse
        .then(() => cacheAppShell())
        .catch(() => undefined),
    );
    return;
  }

  if (!isCacheableStaticRequest(request, url)) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }),
  );
});
