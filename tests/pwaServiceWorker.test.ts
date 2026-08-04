import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

type ServiceWorkerPolicy = {
  staticCache: string;
  discoverShellAssets: (html: string) => string[];
  serveCachedAppShell: (request: Request) => Promise<Response>;
  isCacheableStaticRequest: (
    request: { method: string },
    url: URL,
  ) => boolean;
  isSensitiveRequestPath: (pathname: string) => boolean;
};

const loadPolicy = async ({
  cachedShell,
  fetchResponse,
}: {
  cachedShell?: Response | null;
  fetchResponse?: Response;
} = {}) => {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const listeners = new Map<string, (event: unknown) => void>();
  const self = {
    addEventListener: (name: string, listener: (event: unknown) => void) => {
      listeners.set(name, listener);
    },
    clients: { claim: () => Promise.resolve() },
    location: {
      href: 'https://criativa.example/sw.js?app-version=index-TEST123.js',
      origin: 'https://criativa.example',
    },
  };

  const context = vm.createContext({
    URL,
    Request,
    caches: {
      open: () => Promise.resolve({
        match: () => Promise.resolve(cachedShell ?? null),
      }),
    },
    fetch: () => fetchResponse
      ? Promise.resolve(fetchResponse)
      : Promise.reject(new Error('fetch nao esperado neste teste')),
    self,
  });

  vm.runInContext(
    `${source}\nself.__policy = { staticCache: STATIC_CACHE, discoverShellAssets, serveCachedAppShell, isCacheableStaticRequest, isSensitiveRequestPath };`,
    context,
  );

  return {
    listeners,
    policy: (self as typeof self & { __policy: ServiceWorkerPolicy }).__policy,
    source,
  };
};

test('service worker nunca assume a nova versao durante uma visita aberta', async () => {
  const { listeners, policy, source } = await loadPolicy();

  assert.equal(listeners.has('install'), true);
  assert.equal(listeners.has('activate'), true);
  assert.equal(listeners.has('fetch'), true);
  assert.doesNotMatch(source, /skipWaiting\s*\(/);
  assert.equal(policy.staticCache, 'criativa-pwa-index-TEST123.js-static');
});

test('rotas operacionais e autenticadas ficam fora do cache', async () => {
  const { policy } = await loadPolicy();

  for (const pathname of [
    '/api',
    '/api/auth/login',
    '/.netlify/functions',
    '/.netlify/functions/auth-login',
  ]) {
    assert.equal(policy.isSensitiveRequestPath(pathname), true, pathname);
    assert.equal(
      policy.isCacheableStaticRequest(
        { method: 'GET' },
        new URL(pathname, 'https://criativa.example'),
      ),
      false,
      pathname,
    );
  }
});

test('cache aceita apenas arquivos estaticos conhecidos da propria origem', async () => {
  const { policy } = await loadPolicy();

  assert.equal(
    policy.isCacheableStaticRequest(
      { method: 'GET' },
      new URL('/assets/index-ABC.js', 'https://criativa.example'),
    ),
    true,
  );
  assert.equal(
    policy.isCacheableStaticRequest(
      { method: 'GET' },
      new URL('/icons/icon-192.png', 'https://criativa.example'),
    ),
    true,
  );
  assert.equal(
    policy.isCacheableStaticRequest(
      { method: 'GET' },
      new URL('/visits/visit-1', 'https://criativa.example'),
    ),
    false,
  );
  assert.equal(
    policy.isCacheableStaticRequest(
      { method: 'GET' },
      new URL('/assets/index.js', 'https://outro.example'),
    ),
    false,
  );
});

test('instalacao descobre os arquivos versionados gerados pelo Vite', async () => {
  const { policy } = await loadPolicy();
  const html = `
    <link rel="stylesheet" href="/assets/index-CSS.css">
    <script type="module" src="/assets/index-JS.js"></script>
    <link rel="manifest" href="/manifest.webmanifest">
    <script src="https://outro.example/assets/external.js"></script>
  `;

  assert.deepEqual(
    [...policy.discoverShellAssets(html)].sort(),
    ['/assets/index-CSS.css', '/assets/index-JS.js'],
  );
});

test('navegacao usa o app shell do cache sem consultar a rede', async () => {
  const cachedShell = new Response('<main>offline ios</main>');
  const { policy } = await loadPolicy({ cachedShell });

  const response = await policy.serveCachedAppShell(
    new Request('https://criativa.example/'),
  );

  assert.equal(await response.text(), '<main>offline ios</main>');
});

test('navegacao agenda atualizacao segura do shell sem usar skipWaiting', async () => {
  const { source } = await loadPolicy();

  assert.match(source, /event\.waitUntil\([\s\S]*cacheAppShell\(\)/);
  assert.doesNotMatch(source, /skipWaiting\s*\(/);
});

test('navegacao consulta a rede somente quando o shell ainda nao foi preparado', async () => {
  const fetchResponse = new Response('<main>primeiro acesso online</main>');
  const { policy } = await loadPolicy({ fetchResponse });

  const response = await policy.serveCachedAppShell(
    new Request('https://criativa.example/'),
  );

  assert.equal(await response.text(), '<main>primeiro acesso online</main>');
});

test('Netlify entrega o manifesto com tipo reconhecido pelo iOS', async () => {
  const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  const manifestHeaders = config.match(
    /\[\[headers\]\]\s+for = "\/manifest\.webmanifest"[\s\S]*?(?=\[\[headers\]\]|$)/,
  )?.[0] || '';

  assert.match(manifestHeaders, /Content-Type = "application\/manifest\+json; charset=UTF-8"/);
});
