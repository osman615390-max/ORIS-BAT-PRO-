
const CACHE = 'oris-v16.1-perfected';
const CORE = [
  './', './index.html',
  './style.css?v=16.1', './script.js?v=16.1', './photo360.js?v=16.1',
  './logo-oris-bat-pro.svg', './favicon.svg',
  './hero-1.webp', './hero-2.webp', './fleet-real.webp', './live-camera-chantier.webp',
  './studio-360.html', './chantier-flow.html', './diagnostic.html', './project-command.html', './devis.html', './contact.html', './passeport-projet.html',
  './pano-encours-v132-2048.webp'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const isAsset = /\.(?:webp|png|jpg|jpeg|svg|ico)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(caches.match(event.request).then(hit => {
      const network = fetch(event.request).then(response => {
        if (response && response.ok) {
          caches.open(CACHE).then(cache => cache.put(event.request, response.clone())).catch(() => {});
        }
        return response;
      }).catch(() => hit);
      return hit || network;
    }));
    return;
  }

  event.respondWith(fetch(event.request).then(response => {
    if (response && response.ok) {
      caches.open(CACHE).then(cache => cache.put(event.request, response.clone())).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html'))));
});
