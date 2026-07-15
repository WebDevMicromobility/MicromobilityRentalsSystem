
const CACHE = 'mmcq-v131';
const IMG_CACHE = 'mmcq-img'; // Supabase Storage photos; persists across app versions (content-addressed)
const SHELL = [
  './',
  './index.html',
  './styles.css?v=122',
  './manifest.json',
  './logo.png',
  './logo-dark.png',
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
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; 
  const url = new URL(req.url);

  // Auth callbacks (Google OAuth PKCE "?code=", magic-link / recovery, "?error=") come back
  // as a navigation to our origin carrying auth params. Safari refuses a service-worker
  // response that has redirect history for a navigation ("Response served by service worker
  // has redirections"), which breaks Google sign-in. Don't intercept these — let the browser
  // navigate natively so supabase-js can read the params.
  if (req.mode === 'navigate' &&
      /[?&](code|state|error|error_description|error_code|access_token|refresh_token|provider_token|token_hash)=/.test(url.search)) {
    return;
  }


  // The page shell: serve the cached index.html INSTANTLY (no network wait), and refresh
  // it in the background for next time (stale-while-revalidate). A new deploy therefore
  // applies on the next load rather than blocking this one. First-ever visit (nothing
  // cached) falls back to the network.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((cached) => {
        const network = fetch(req).then((res) => {
          // A redirected response can't back a navigation in Safari; only cache/return clean ones.
          if (res && res.ok && !res.redirected) {
            const copy = res.clone();
            // If the shell actually changed (new deploy), tell open pages so they can refresh
            // themselves — otherwise a stale (possibly buggy) build keeps running for a full visit.
            const newTag = res.headers.get('etag');
            const oldTag = cached && cached.headers.get('etag');
            const changed = !!cached && (!newTag || !oldTag || newTag !== oldTag);
            caches.open(CACHE).then((c) => c.put('./index.html', copy)).then(() => {
              if (changed) self.clients.matchAll({ type: 'window' }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'shell-updated' })));
            });
          }
          return res && res.redirected
            ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
            : res;
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

  // Supabase Storage product/profile photos: cache-first in a separate, capped cache so
  // they load instantly on repeat views instead of a ~1s fetch each time. Filenames are
  // content-addressed (uid.jpg), so a cached copy is never stale.
  if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/')) {
    e.respondWith(
      caches.open(IMG_CACHE).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res && res.ok) { c.put(req, res.clone()); trimCache(IMG_CACHE, 120); }
          return res;
        }).catch(() => hit))
      )
    );
    return;
  }
});

// Keep the image cache from growing unbounded: drop the oldest entries past `max`.
async function trimCache(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  if (keys.length > max) for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
