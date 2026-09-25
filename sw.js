/*
 * Service worker: makes the app work offline and caches every file permanently.
 *
 * Caching model
 * - All files are precached on install and then served cache-first, forever.
 *   Nothing is re-downloaded until a new version of this file is deployed.
 * - scripts/build.mjs stamps VERSION (a content hash of the whole site) and the
 *   PRECACHE list below. Any change to any file changes VERSION, which changes the
 *   bytes of sw.js, so the browser installs the new worker, fills a new cache and
 *   deletes the old one once the page accepts the update.
 * - The page registers this worker with updateViaCache: 'none', so sw.js itself is
 *   always checked on the network and never served from the HTTP cache.
 */
const VERSION = /*BUILD:VERSION*/'dev'/*END*/;
const PRECACHE = /*BUILD:PRECACHE*/[
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
]/*END*/;
const CACHE = 'gt-' + VERSION;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' bypasses the HTTP cache so a fresh copy of each file is stored.
    await cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
    // First install: nothing to replace, take over immediately.
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('gt-') && k !== CACHE).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.disable();
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App shell: every navigation (including ?text=… from the share target and #tabs)
  // is answered with the cached index.html.
  if (req.mode === 'navigate'){
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match('index.html') || await cache.match('./');
      if (hit) return hit;
      try { return await fetch(req); }
      catch (e) { return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
    })());
    return;
  }

  // Everything else: cache-first, forever. Anything not precached is stored on first use.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  })());
});
