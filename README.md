# Coach Field ? V5A Multi-Staff Foundation

Recovery incrementale del checkpoint V1?V4: pagine tecniche esistenti, IndexedDB versione **5** invariata, nessuna migrazione dei dati sportivi al cloud.

- Supabase: Auth, profili, societ?, gruppi, membership e permessi con RLS.
- Flusso: home pubblica ? login staff ? selettore gruppi ? /app/:groupId/today.
- Admin di societ?: tutti i gruppi, creazione/modifica/disattivazione e staff. Coach: controllo tecnico e collaboratori dei gruppi assegnati. Collaborator: default conservativi e override delegabili.
- Dataset sportivo ancora locale: associazione esplicita a un solo gruppo; altri gruppi mostrano empty state. Nessuna condivisione sportiva fra dispositivi in V5A.
- Backup conserva binding, stato e audio; esclude sessioni, token e chiavi. Logout conserva IndexedDB.
- La rosa reale del vecchio seed non viene pi? inserita nelle nuove installazioni o pubblicata nel bundle; i dati gi? presenti restano intatti.

## Avvio

```sh
npm ci
npm run dev
```

Copiare .env.example in .env.local e configurare il progetto seguendo [setup Supabase, migration, bootstrap admin e privacy](docs/v5a-supabase-setup.md). Senza env la home pubblica funziona e il login segnala la configurazione mancante. Non utilizzare service-role key nel frontend.

## Verifica

```sh
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

I test coprono permessi, accesso gruppi, regressioni dei repository locali, backup, SQL/RLS su PostgreSQL PGlite e smoke browser con Supabase simulato. Non attestano un login reale. Vedere [report recovery](docs/v5a-recovery-report.md) e [known issues](docs/12-known-issues.md).

V5B (cloud sportivo + offline sync), V6 Parent Portal, redesign e AI **non implementati**. Commit e push restano sotto controllo dell'utente.

## Documentazione del checkpoint recuperato

Il testo seguente ? il riferimento storico V1?V4. Routing, stato Auth/backend, seed e test sono aggiornati dalle sezioni V5A e dalla documentazione collegata sopra.

# Coach Field

Coach Field e una PWA mobile-first per supportare un allenatore di calcio giovanile durante allenamenti e partite. L'app concentra in pochi tap template, sessioni reali, presenze, osservazioni, note vocali, valutazioni individuali e storico giocatore.

Il progetto nasce per risolvere un problema concreto: durante un allenamento non c'e tempo per navigare menu complessi, prendere appunti lunghi o ricordare a memoria tutte le consegne. Coach Field porta sul telefono una traccia pratica della seduta e uno spazio locale per salvare osservazioni rapide, anche offline.

L'utente principale e un allenatore di calcio giovanile che usa iPhone, smartphone o tablet direttamente a bordo campo.

## Core Features

- Seduta corrente divisa in fasi, con timer, reset, pausa, chiusura fase e navigazione rapida.
- Gestione allenamenti V3 con template riutilizzabili, sessioni da template o da zero e snapshot storico.
- Dettaglio sessione allenamento con presenze, programma, valutazione fasi, note staff, takeaways e completamento.
- Valutazioni individuali di allenamento con rating a mezze stelle, ruoli provati, tag, note e nota vocale.
- Storico allenamenti nel profilo giocatore con media dinamica e statistica presenze.
- Dettaglio esercizi in bottom sheet, con obiettivi, setup, istruzioni, regole, varianti, domande e segnali da osservare.
- Adattamento degli esercizi al numero di presenti per Fase 2, Fase 3 e partita finale.
- Gestione presenze locale con selezione singola, tutti presenti e azzera.
- Rosa reale seedata con 21 giocatori e migrazione versionata del seed.
- Aggiunta rapida di giocatori ospiti da rosa o da presenze.
- Promozione di un ospite a giocatore di rosa dal profilo.
- Profilo giocatore con osservazioni rapide, note testuali, valutazione a stelle e ruoli ideali.
- Player development qualitativo con tab Panoramica, Timeline, Obiettivi e Storico nel profilo giocatore.
- Obiettivi individuali attivi/pausa/raggiunti/archiviati, evidenze rapide da partita o allenamento e review periodiche.
- Gestione partite con creazione match, filtri, convocati/partecipanti, risultato, note staff e completamento.
- Valutazioni individuali per partita con rating a mezze stelle, ruoli giocati, titolare, tag positivi/attenzione, note e note vocali.
- Storico partite nel profilo giocatore con media partita separata dalla valutazione generale manuale.
- Area portieri per segnare candidati, aggiungere tag specifici e consultare note.
- Registrazione di note vocali tramite MediaRecorder, associate a seduta, fase, esercizio o giocatore.
- Archivio note con filtri per giocatore e fase.
- Esportazione backup JSON completo con audio base64 e ripristino dati.
- Sistema multi-tema dark con Pitch, Electric Blue, Purple Data e Ice Cyan.
- PWA installabile con service worker e precache degli asset di build.

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- IndexedDB tramite `idb`
- Vite PWA / Workbox tramite `vite-plugin-pwa`
- Lucide React per le icone
- CSS custom properties per il design system e i temi
- ESLint con preset TypeScript, React Hooks e React Refresh

## Architecture

L'app e una single-page application React. Il routing e definito in `src/App.tsx`; il layout principale vive in `src/components/Layout.tsx`; le pagine sono in `src/pages`; la persistenza locale e incapsulata in repository sotto `src/db`.

La UI non accede direttamente a IndexedDB: passa da funzioni repository come `getPlayers`, `savePlayer`, `addObservation`, `getVoiceNotes`, `ensureAttendanceForSession`.

## Offline-First

Coach Field salva i dati applicativi in IndexedDB nel browser:

- giocatori
- sedute
- osservazioni
- note vocali
- stato app
- presenze
- partite
- valutazioni partita
- template allenamento
- valutazioni allenamento
- obiettivi giocatore
- evidenze obiettivo
- review sviluppo giocatore

La PWA usa un service worker generato da `vite-plugin-pwa` per mettere in cache gli asset statici della build. Questo rende l'app installabile e consultabile offline dopo il primo caricamento riuscito.

Il tema selezionato e salvato in `localStorage` per applicarlo subito prima del rendering React ed evitare il flash del tema sbagliato.

## Project Structure

```text
coach-field/
  public/                 Asset pubblici PWA
  src/
    components/           Componenti riusabili e bottom sheet
    data/                 Seed della rosa e della seduta
    db/                   IndexedDB e repository layer
    pages/                Route principali
    styles/               Token dei temi
    types/                Tipi dominio TypeScript
    utils/                Utility di formato, giocatori e adattamento
    App.tsx               Routing e inizializzazione DB
    main.tsx              Bootstrap React e ThemeProvider
  docs/                   Documentazione estesa
  index.html              Shell HTML e script tema iniziale
  vite.config.ts          Config React + PWA
```

## Running Locally

```bash
npm install
npm run dev
npm run build
```

Altri comandi disponibili:

```bash
npm run lint
npm run preview
```

## Deployment

Il repository contiene una configurazione Vite standard e una configurazione PWA in `vite.config.ts`. Non e presente una configurazione Vercel dedicata (`vercel.json`) nel repository.

Il progetto puo essere distribuito come applicazione statica generata da:

```bash
npm run build
```

La build produce la cartella `dist/`.

## Current Status

Coach Field e un MVP funzionante per uso locale/mobile-first. Le funzionalita centrali sono implementate: timer, presenze, rosa, osservazioni, note vocali, adattamento ai presenti, gestione partite, template/sessioni allenamento, player development qualitativo, PWA, temi e backup completo.

Non sono presenti backend, autenticazione, sincronizzazione cloud o test automatici. L'editor template/sessioni e volutamente essenziale e mobile-first.

## Roadmap

Vedi [docs/09-roadmap.md](docs/09-roadmap.md).

## Technical Documentation

- [Product Overview](docs/01-product-overview.md)
- [Architecture](docs/02-architecture.md)
- [Data Model](docs/03-data-model.md)
- [Features](docs/04-features.md)
- [User Flows](docs/05-user-flows.md)
- [Design System](docs/06-design-system.md)
- [PWA and Offline](docs/07-pwa-offline.md)
- [Development Guide](docs/08-development-guide.md)
- [Roadmap](docs/09-roadmap.md)
- [Interview Notes](docs/10-interview-notes.md)
- [Decisions](docs/11-decisions.md)
- [Known Issues](docs/12-known-issues.md)
