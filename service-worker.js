
const CACHE = 'mmcq-v91';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=85',
  './manifest.json',
  './logo.png',
  './brand.png',
  './hero.webp',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; 
  const url = new URL(req.url);

  
  // The page shell: serve the cached index.html INSTANTLY (no network wait), and refresh
  // it in the background for next time (stale-while-revalidate). A new deploy therefore
  // applies on the next load rather than blocking this one. First-ever visit (nothing
  // cached) falls back to the network.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((cached) => {
        const network = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  
  // Same-origin (incl. the self-hosted vendor/ libraries): cache-first, then network.
  // Vendor filenames are version-pinned, so a cached copy is never stale.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit))
    );
    return;
  }
});
