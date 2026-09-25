# Known Issues

## Limiti correnti V5A

- Nessun login o deploy verificato contro un progetto Supabase reale: test Auth browser simulati, RLS eseguite in PGlite con auth.uid/ruoli di test.
- Un solo dataset sportivo per browser; gli altri gruppi mostrano empty state. I dati non sono condivisi fra membri o dispositivi fino a V5B.
- IndexedDB non cifrato: un utente con accesso al profilo browser pu? leggere lo storage. Usare profili browser separati se necessario.
- Profilo e autorizzazioni richiedono rete all'avvio/rivalidazione; nessuna auth offline custom o revoca istantanea mentre offline.
- Account staff e amministratori di societ? vengono predisposti da un operatore Supabase; nessuna UI signup, inviti o recupero password in V5A.
- Ripristino sostituisce gli store presenti nel file, non effettua merge; backup vecchi senza mapping richiedono nuova associazione. Il backup pu? essere grande per audio base64.
- Microfono reale, iOS/Safari, installazione standalone su dispositivo e refresh token reale restano verifiche manuali.
- Il vecchio file seed contiene dati storici nella repository: escluso dal bundle distribuito, ma il recovery non riscrive la storia Git.
- Le limitazioni funzionali V1?V4 (review non modificabili, editor template essenziale, statistiche avanzate assenti) restano valide.

## Riferimento storico V1?V4

Le sezioni seguenti descrivono il checkpoint recuperato. Dove differiscono su routing, Auth, backend, seed o test, prevale lo stato V5A sopra.

## Nessuna Suite Di Test Automatica

Il repository non contiene test unitari o e2e. La qualita viene verificata con lint, build e test manuali.

Impatto: regressioni su flussi IndexedDB o UI mobile possono passare inosservate.

## Backup Audio Potenzialmente Pesante

`exportCoachFieldData()` esporta i blob audio come Data URL base64.

Impatto: il file JSON puo diventare grande se l'archivio contiene molte note vocali.

## Restore Distruttivo Per Gli Store Applicativi

Il restore completo cancella e sostituisce gli store applicativi presenti nel backup, incluse partite e valutazioni partita.

Impatto: e utile come ripristino completo, ma non come import incrementale.

## Partite Senza Statistiche Avanzate

La gestione partite salva metadati, partecipanti, valutazioni, ruoli, titolare, note, risultato e valutazione squadra.

Impatto: non sono ancora presenti marcatori, assist, minuti giocati, formazioni o statistiche gara avanzate.

## Player Development Senza Grafici Trend

La V4 salva obiettivi, evidenze e review, e costruisce una timeline testuale derivata.

Impatto: non sono ancora presenti grafici, reminder o indicatori visuali di trend sugli obiettivi.

## Review Non Modificabili Da UI

Le review di sviluppo possono essere create e consultate nella timeline/stato attuale, ma non esiste ancora una schermata di modifica dedicata.

Impatto: eventuali correzioni richiedono un'evoluzione UI futura o intervento sui dati locali.

## Una Sola Seduta Seedata

Il progetto contiene ancora una seduta principale in `src/data/sessionSeed.ts`, ma V3 permette di creare nuove sessioni e template.

Impatto: la seduta seedata resta importante per onboarding e fallback; non esiste ancora un calendario stagionale completo.

## Editor Template Essenziale

La creazione template gestisce titolo, durata, range giocatori, tag e fasi testuali con note.

Impatto: non esiste ancora una libreria esercizi master selezionabile, ne drag and drop delle fasi.

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
