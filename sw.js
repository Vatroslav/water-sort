/* Service worker - network-first uz zaobilazenje HTTP cachea
   (online uvijek svjeza verzija, cache kao offline fallback).
   CACHE naziv je interni, ne verzija aplikacije. */
const CACHE = "water-sort-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./levels.js",
  "./audio.js",
  "./app.js",
  "./package.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.all(
          ASSETS.map((url) =>
            fetch(url, { cache: "reload" })
              .then((resp) => c.put(url, resp))
              .catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // no-cache = pitaj server je li se datoteka promijenila (304 ako nije). Bez toga je
  // HTTP cache znao dati stari levels.js uz novi app.js - pola stare, pola nove verzije.
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return resp;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
