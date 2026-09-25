# Product Overview

## Stato V5A recuperato

Il prodotto ora distingue home pubblica e area tecnica staff. La gerarchia ? Organization ? Group ? GroupMembership ? dati sportivi. Un utente pu? essere coach in un gruppo e collaborator in un altro; admin ? un incarico per societ?. La stessa installazione supporta pi? societ? senza ID fissi.

V1?V4 restano operative sul dataset IndexedDB associato al gruppo. Supabase gestisce soltanto identit?, societ?, gruppi, membership e permessi. Migrazione sportiva/sync sono V5B; parent portal ? V6, non implementato. Le installazioni nuove non caricano la rosa reale del vecchio seed.

## Riferimento storico V1?V4

Le sezioni seguenti descrivono il checkpoint recuperato. Dove differiscono su routing, Auth, backend, seed o test, prevale lo stato V5A sopra.

## Problema

Coach Field risolve un problema operativo: durante un allenamento di calcio giovanile l'allenatore deve gestire tempo, consegne, presenze e osservazioni senza perdere attenzione sul campo.

Un foglio cartaceo e facile da sporcare o dimenticare; una nota generica sul telefono non struttura bene fasi, giocatori e osservazioni; un gestionale completo spesso e troppo lento durante una seduta reale.

## Utente principale

L'utente principale e un allenatore di calcio giovanile. Il contesto del seed attuale riguarda una rosa 2016/2017, ma la struttura dati supporta anche giocatori ospiti e anno "Altro".

## Contesto d'uso

L'app e pensata per smartphone e tablet, soprattutto durante l'allenamento. La UI usa bottom sheet, touch target grandi, navigazione bassa e testi brevi per essere utilizzabile con una mano.

## Obiettivi

- Seguire la seduta corrente fase per fase.
- Gestire rapidamente i presenti.
- Adattare le esercitazioni al numero reale di bambini.
- Consultare consegne e regole speciali senza cercare in documenti lunghi.
- Registrare note vocali al volo.
- Salvare osservazioni positive o punti attenzione.
- Valutare tecnicamente i giocatori con stelle.
- Segnare ruoli ideali e candidati portieri.
- Conservare i dati localmente anche offline.

## Principi UX

- Mobile first: la UI primaria e ottimizzata per iPhone/smartphone.
- Pochi tap: le azioni ricorrenti sono pulsanti diretti.
- Touch target grandi: bottoni, chip e righe selezionabili hanno dimensioni adatte al campo.
- Autosave: osservazioni, rating, ruoli, presenze e tema vengono salvati subito.
- Bottom sheet: i dettagli complessi non fanno perdere il contesto.
- Offline-first: IndexedDB contiene i dati applicativi; la PWA precachea gli asset statici.
- Nessun flusso pesante durante l'allenamento: il prodotto privilegia rapidita e chiarezza.

## Evoluzione Del Prodotto

Implemented:

- Seduta seed "Primo allenamento 2016/2017".
- Rosa reale da 21 giocatori.
- Versioning/migrazione del seed giocatori.
- Presenze per seduta.
- Adattamento ai presenti per fasi con esercizi/campi principali.
- Osservazioni rapide e note testuali.
- Note vocali locali.
- Profilo giocatore con rating, ruoli ideali e stato ospite/roster.
- Area portieri.
- Archivio note con filtri.
- Backup JSON e restore parziale.
- Sistema multi-tema dark.
- PWA installabile.

Planned / non ancora implementato:

- Creazione e modifica completa di piu sedute.
- Sincronizzazione cloud.
- Account utente e autenticazione.
- Condivisione dati tra dispositivi.
- Test automatici unit/e2e.
- Analytics prodotto.
- Export PDF o report strutturato.
