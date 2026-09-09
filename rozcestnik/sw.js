// Network-first with cache fallback: always try to fetch the latest version
// first (so updates show up immediately, no stale-content confusion), and
// only fall back to the cached copy when the network genuinely fails (offline).
// Bump CACHE_NAME whenever the shell file list changes.
var CACHE_NAME = "rozcestnik-v3";
var SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/store.js",
  "./js/dates.js",
  "./js/icons.js",
  "./js/today-view.js",
  "./js/view-dnes.js",
  "./js/view-kalendar.js",
  "./js/view-questy.js",
  "./js/view-nastaveni.js",
  "./js/main.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(function (resp) {
      if (resp && resp.ok) {
        var copy = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return resp;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
