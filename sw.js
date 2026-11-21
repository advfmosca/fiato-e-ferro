/* Service worker di Fiato e Ferro.
   A ogni modifica di index.html, app.js, style.css o delle icone alza VERSION.
   program.json non lo richiede: viene chiesto prima alla rete e, senza connessione, preso dalla cache. */
const VERSION = 'fef-2026-11-21-1';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'program.json',
  'manifest.json',
  'icon.svg',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request, timeoutMs) {
  return caches.open(VERSION).then((cache) => new Promise((resolve) => {
    let settled = false;
    const fromCache = () => cache.match(request, { ignoreSearch: true }).then((r) => r || cache.match('index.html'));
    const timer = setTimeout(() => {
      fromCache().then((r) => { if (r && !settled) { settled = true; resolve(r); } });
    }, timeoutMs);
    fetch(request, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
        clearTimeout(timer);
        if (!settled) { settled = true; resolve(res); }
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then((r) => { if (!settled) { settled = true; resolve(r || Response.error()); } });
      });
  }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/program.json')) {
    event.respondWith(networkFirst(req, 2500));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then((r) => r || fetch(req))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
      return res;
    }))
  );
});
