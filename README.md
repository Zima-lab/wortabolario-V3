# Wortabolario v3

Vocabolario tedesco ↔ italiano/inglese per il corso B1 — app web offline (PWA).

**Sito:** https://zima-lab.github.io/wortabolario-V3/

## Cosa contiene

- Ricerca in tedesco, italiano e inglese, tollerante agli errori di battitura
- Schede di verbi, sostantivi, aggettivi, grammatica, frasi e detti
- Coniugatore completo (Indikativ, Konjunktiv, Imperativ, participi)
- Flashcard bidirezionali con ripetizione spaziata (sistema Leitner)
- Quiz *der/die/das* e quiz di coniugazione
- Preferiti, parole imparate, serie di giorni consecutivi
- Backup dei progressi in JSON (esporta / importa)
- Funziona offline e si installa sul telefono

## File

| File | Cosa contiene |
|---|---|
| `index.html` | struttura della pagina |
| `style.css` | stile e caratteri |
| `data.js` | **il vocabolario** — per aggiungere parole si modifica solo questo |
| `app.js` | logica dell'app |
| `sw.js` | service worker (funzionamento offline) |
| `fonts/` | Istok Web e Poltawski Nowy (licenza SIL OFL) |

## Aggiornare il sito

Dopo aver caricato file modificati, **incrementare `CACHE_VERSION` in `sw.js`**
(es. da `wortabolario-v7` a `wortabolario-v8`), altrimenti i dispositivi
continuano a usare la versione in cache.

Nota: il CDN di GitHub Pages serve i file vecchi per circa 10 minuti dopo il
commit. Aspettare prima di aprire il sito, poi ricaricare forzatamente (⌘⇧R).

## Licenze

Codice e contenuti didattici: uso personale.
I caratteri in `fonts/` sono distribuiti con licenza SIL Open Font License
(vedi `fonts/OFL-IstokWeb.txt` e `fonts/OFL-PoltawskiNowy.txt`).
