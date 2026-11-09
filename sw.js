// Service worker minimo: rende Sahbi installabile come app e mostra una pagina se manca internet.
// Tutto passa PRIMA dalla rete (cosi l'app e sempre aggiornata); la copia salvata serve solo senza connessione.
const CACHE = 'sahbi-v2';
const SHELL = ['/', '/logo.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/i18n.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin || req.url.includes('/api/')) return;
  const key = req.mode === 'navigate' ? '/' : req;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return r; })
      .catch(() => caches.match(key).then((hit) => hit || Response.error())),
  );
});
