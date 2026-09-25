# PWA And Offline

## Confine offline V5A

Manifest, standalone, installazione e precache asset restano gestiti da vite-plugin-pwa. start_url ? /, ora home pubblica. Non viene aggiunta cache runtime per API Auth/Supabase o risposte staff. Il service worker non ? un meccanismo di autorizzazione.

I dati sportivi restano IndexedDB. La sessione e il refresh token sono responsabilit? dell'SDK Supabase, mai inclusi nel backup sportivo. Il caricamento di profilo/gruppi/permessi richiede rete; un avvio offline non garantisce l'accesso privato. Nessuna auth offline custom e nessuna sync V5B. I temi continuano a usare localStorage e vengono ripristinati dal backup.

## Riferimento storico V1?V4

Le sezioni seguenti descrivono il checkpoint recuperato. Dove differiscono su routing, Auth, backend, seed o test, prevale lo stato V5A sopra.

## Configurazione PWA

La PWA e configurata in `vite.config.ts` con `vite-plugin-pwa`.

Impostazioni principali:

- `registerType: 'autoUpdate'`
- manifest con `name`, `short_name`, `display: 'standalone'`, `start_url: '/'`
- icona SVG maskable
- Workbox `globPatterns` per `js`, `css`, `html`, `svg`, `png`, `ico`

## Service Worker

Il service worker viene generato durante `npm run build`. I file finali si trovano in `dist/`, per esempio:

- `registerSW.js`
- `sw.js`
- file Workbox
- `manifest.webmanifest`

## Persistenza Offline

I dati sono salvati localmente in IndexedDB. Questo significa che le funzioni core non richiedono backend:

- rosa
- presenze
- osservazioni
- note vocali
- seduta seed
- template allenamento
- sessioni allenamento
- valutazioni allenamento
- stato corrente

## Theme Persistence

Il tema e salvato in `localStorage`, non in IndexedDB. La scelta e intenzionale per applicare il tema prima che React monti l'app.

## Limiti Offline

- Il primo caricamento deve avvenire almeno una volta online o da build servita localmente.
- Non esiste sincronizzazione cloud.
- I dati restano sul dispositivo/browser usato.
- In modalita privata o con storage bloccato, IndexedDB puo fallire; l'app mostra un errore.
- Il backup JSON puo diventare grande se contiene molte note vocali, perche include l'audio in base64.

## Installazione Su Mobile

L'app ha meta tag per comportamento standalone mobile:

- `mobile-web-app-capable`
- `apple-mobile-web-app-capable`
- `apple-mobile-web-app-title`
- `apple-mobile-web-app-status-bar-style`

Su iPhone, l'installazione passa dal menu di condivisione Safari con "Aggiungi alla schermata Home".
