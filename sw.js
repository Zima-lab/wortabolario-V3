/* Service worker Wortabolario — strategia "stale-while-revalidate":
   risponde subito dalla cache (funziona offline), poi aggiorna la cache
   dalla rete in background. Alla pubblicazione di una nuova versione,
   incrementare CACHE_VERSION per ripartire da una cache pulita. */

const CACHE_VERSION = "wortabolario-v10";
const PRECACHE = [
  ".",
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "fonts/IstokWeb-Regular.woff2",
  "fonts/IstokWeb-Bold.woff2",
  "fonts/IstokWeb-Italic.woff2",
  "fonts/IstokWeb-BoldItalic.woff2",
  "fonts/PoltawskiNowy-Variable.woff2",
  "manifest.webmanifest",
  "icon.png",
  "favicon.png",
  "Grammatica_Tedesca_B1_Bignami.pdf"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // solo GET della stessa origine (i link esterni tipo Duden passano diretti)
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached); // offline: resta sulla cache
      return cached || network;
    })
  );
});
