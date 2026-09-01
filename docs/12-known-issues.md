# Known Issues

## Nessuna Suite Di Test Automatica

Il repository non contiene test unitari o e2e. La qualita viene verificata con lint, build e test manuali.

Impatto: regressioni su flussi IndexedDB o UI mobile possono passare inosservate.

## Backup Audio Potenzialmente Pesante

`exportCoachFieldData()` esporta i blob audio come Data URL base64.

Impatto: il file JSON puo diventare grande se l'archivio contiene molte note vocali.

## Restore Distruttivo Per Alcuni Store

Il restore cancella e sostituisce `players`, `observations`, `sessions` e `attendance`.

Impatto: e utile come ripristino completo, ma non come import incrementale.

## Una Sola Seduta Seedata

Il progetto contiene una seduta principale in `src/data/sessionSeed.ts`.

Impatto: non e ancora possibile creare o gestire un calendario di allenamenti dall'interfaccia.

## Nessun Backend O Sync

Tutti i dati restano nel browser.

Impatto: nessuna condivisione tra dispositivi, nessun recupero cloud, nessuna autenticazione.

## Voice Recording Dipende Dal Browser

La registrazione richiede supporto a `MediaRecorder` e permesso microfono.

Impatto: alcuni browser o contesti non sicuri possono non supportare la funzione.

## Timer Locale

Il timer usa stato locale salvato in `appState`, ma non implementa un sistema avanzato di recupero sessione o notifiche.

Impatto: va bene per MVP, ma non sostituisce un cronometro professionale con alert/lock screen.

## Theme Preview Hardcoded

Le preview dei temi usano colori hardcoded intenzionali in CSS.

Impatto: se cambia una palette, bisogna aggiornare sia `themes.css` sia la preview corrispondente.

## Asset Template Non Rimossi

Sono ancora presenti asset `src/assets/react.svg` e `src/assets/vite.svg` del template Vite.

Impatto: non risultano parte della UI principale, ma sono rumore nel repository.
