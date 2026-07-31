/* UNICA fonte della versione dell'app.
   - index.html la carica per primo script → la pagina mostra "v…" nel footer
   - sw.js la importa con importScripts → CACHE_VERSION = "wortabolario-" + APP_VERSION
   Per pubblicare una nuova versione basta incrementare QUESTO numero. */
const APP_VERSION = "v17";
