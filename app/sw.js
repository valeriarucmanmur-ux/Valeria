// Offline support. Bump VERSION whenever index.html, vendor files or data change.
const VERSION = "bali-2026-11-17-fruit";
const SHELL = ["./", "index.html", "manifest.webmanifest", "vendor/leaflet.js", "vendor/leaflet.markercluster.js",
  "data/places.enc.json", "icons/icon-192.png", "icons/icon-512.png"];
const TILES = "bali-tiles";   // map tiles you have viewed, kept across versions
const MEDIA = "bali-media";   // photos + road network, kept across versions
const MAX_TILES = 6000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILES && k !== MEDIA && k !== "bali-offline").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function cacheFirst(req, name, trim) {
  const cache = await caches.open(name);
  const hit = await cache.match(req) || (name === TILES ? await (await caches.open("bali-offline")).match(req.url) : null);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    cache.put(req, res.clone());
    if (trim) trimCache(cache);
  }
  return res;
}

let trimming = false;
async function trimCache(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_TILES) await Promise.all(keys.slice(0, keys.length - MAX_TILES + 500).map(k => cache.delete(k)));
  } finally { trimming = false; }
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("arcgisonline.com")) return e.respondWith(cacheFirst(req, TILES, true));
  if (url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) return e.respondWith(cacheFirst(req, MEDIA));
  if (url.hostname.endsWith(".wikimedia.org")) return e.respondWith(cacheFirst(req, MEDIA));
  if (url.origin !== location.origin) return;
  if (url.pathname.includes("/photos/") || url.pathname.endsWith("/data/roads.json")) return e.respondWith(cacheFirst(req, MEDIA));
  e.respondWith(networkFirst(req));
});
