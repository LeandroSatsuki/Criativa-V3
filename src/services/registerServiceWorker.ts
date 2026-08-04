export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  const serviceWorkerUrl = new URL('/sw.js', window.location.origin);
  const bundleName = new URL(import.meta.url).pathname.split('/').pop() || 'app';
  serviceWorkerUrl.searchParams.set('app-version', bundleName);

  void navigator.serviceWorker.register(serviceWorkerUrl, {
    scope: '/',
    updateViaCache: 'none',
  }).catch((error) => {
    console.warn('Falha ao registrar service worker da PWA.', error);
  });
};
