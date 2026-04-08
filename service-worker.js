// EuroPoi Service Worker — offline caching + sessie heractivering
const CACHE = "europoi-v2";
const ASSETS = [
  "/EuroPoi/",
  "/EuroPoi/index.html",
  "/EuroPoi/EuroPoiLogo.png",
  "/EuroPoi/bike-bell-40094.mp3"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Sessie heractivering: als de app al open staat, focus die
// in plaats van een nieuwe instantie te openen
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("EuroPoi") && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow("/EuroPoi/");
      })
  );
});

// Heractiveer bestaande sessie bij opstarten vanuit homescreen
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

// Fetch: netwerk eerst, cache als fallback
self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("tile.openstreetmap.org") ||
      e.request.url.includes("arcgisonline.com") ||
      e.request.url.includes("elevenlabs.io")) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
