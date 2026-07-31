/* Service worker Wortabolario — due strategie diverse a seconda del file.
   Alla pubblicazione di una nuova versione basta incrementare APP_VERSION
   in version.js (unica fonte, mostrata anche nel footer).

   PERCHÉ due strategie: con "stale-while-revalidate" su tutto, il codice
   dell'app veniva servito dalla cache e aggiornato solo DOPO — quindi al
   primo caricamento dopo un deploy si vedeva sempre la versione VECCHIA,
   e la nuova compariva solo al caricamento successivo ("ma non è cambiato
   niente!"). Ora:
     - codice (html/js/css) → NETWORK-FIRST: se c'è rete vince sempre il
       server, quindi l'aggiornamento si vede subito; senza rete si torna
       alla cache e l'app resta perfettamente offline.
     - font, icone, PDF → CACHE-FIRST: sono pesanti e cambiano di rado,
       quindi restano istantanei e non consumano dati. */

importScripts("version.js");
const CACHE_VERSION = "wortabolario-" + APP_VERSION;
const PRECACHE = [
  ".",
  "index.html",
  "style.css",
  "version.js",
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
  "Grammatica_Tedesca_B1_Bignami.pdf",
  "German_Grammar_B1_Bignami_EN.pdf"
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

/* È "codice dell'app" tutto ciò che cambia a ogni versione: la pagina,
   gli script, il foglio di stile. Tutto il resto è un asset statico. */
function isCodice(url) {
  const p = new URL(url).pathname;
  return p.endsWith("/") || /\.(html|js|css)$/.test(p) || p.endsWith("webmanifest");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // solo GET della stessa origine (i link esterni tipo Duden passano diretti)
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });

      if (isCodice(req.url)) {
        /* NETWORK-FIRST: prima il server, la cache è solo la rete di sicurezza.
           `cache: "no-store"` evita che sia la cache HTTP del browser (o il CDN
           di GitHub Pages) a restituire comunque il file vecchio. */
        try {
          const res = await fetch(req, { cache: "no-store" });
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (e) {
          if (cached) return cached;   // offline
          throw e;
        }
      }

      /* CACHE-FIRST per font, icone e PDF: risposta istantanea,
         aggiornamento silenzioso in background per la volta dopo. */
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
