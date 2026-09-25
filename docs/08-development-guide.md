# Development Guide

## Sviluppo e verifica V5A

Installare con npm ci. Copiare .env.example in .env.local e seguire [setup Supabase](v5a-supabase-setup.md). Senza configurazione, home e login funzionano e il login spiega le variabili mancanti. Non inserire service-role key o credenziali reali nel repository.

Comandi: npm run dev; npm run build; npm run lint; npm test. Per il browser: npx playwright install chromium e npm run test:e2e. Vitest verifica resolver, accesso gruppi, repository con fake-indexeddb e RLS/migration realmente eseguite in PostgreSQL PGlite. Playwright avvia due server locali, uno senza configurazione e uno con API Supabase simulate. I fixture non sono account reali e non raggiungono il cloud.

Il deploy statico deve riscrivere i deep link su index.html. Non pubblicare src/ o i file del seed: distribuire esclusivamente dist/. Il seed reale non ? importato nella build. Prima dell'uso operativo eseguire anche test sul progetto Supabase reale.

## Riferimento storico V1?V4

Le sezioni seguenti descrivono il checkpoint recuperato. Dove differiscono su routing, Auth, backend, seed o test, prevale lo stato V5A sopra.

## Requisiti

- Node.js compatibile con il progetto.
- npm.

Le dipendenze reali sono dichiarate in `package.json`.

## Setup

```bash
npm install
```

## Sviluppo

```bash
npm run dev
```

Avvia Vite in modalita sviluppo.

## Build

```bash
npm run build
```

Esegue:

```bash
tsc -b && vite build
```

## Preview Produzione

```bash
npm run preview
```

Serve la build prodotta in `dist/`.

## Lint

```bash
npm run lint
```

La configurazione e in `eslint.config.js`.

## Aggiungere Una Pagina

1. Creare un componente in `src/pages`.
2. Aggiungere la route in `src/App.tsx`.
3. Valutare se serve una voce in `Layout`.
4. Usare repository esistenti per accesso dati.

## Aggiungere Un Campo Al Modello

1. Aggiornare `src/types/domain.ts`.
2. Aggiornare seed e repository coinvolti.
3. Se riguarda dati persistiti, aggiungere migrazione in `initializeDatabase()`.
4. Mantenere compatibilita con record IndexedDB gia esistenti.
5. Eseguire build e test manuale con database gia popolato.

## Aggiungere Un Tema

1. Estendere `AppTheme` in `src/theme.ts`.
2. Aggiungere voce in `APP_THEMES`.
3. Aggiungere blocco `[data-theme='...']` in `src/styles/themes.css`.
4. Aggiungere preview CSS in `src/index.css`.
5. Aggiornare lo script iniziale in `index.html`.

## Regole CSS

- Usare token da `themes.css`.
- Evitare colori hardcoded nei componenti.
- Mantenere touch target ampi.
- Non duplicare CSS per pagina se un pattern e riusabile.

## Debug IndexedDB

Store principali:

- `players`
- `sessions`
- `observations`
- `voiceNotes`
- `appState`
- `attendance`
- `matches`
- `matchPlayerEvaluations`
- `trainingTemplates`
- `trainingPlayerEvaluations`
- `playerObjectives`
- `playerObjectiveEvidence`
- `playerDevelopmentReviews`

La versione IndexedDB attuale e `5`. Le sessioni V3 continuano a usare lo store `sessions`; i nuovi campi sono opzionali per compatibilita con record V1. Gli store V4 sono additivi e i backup vecchi senza questi dati restano ripristinabili.

## Player Development

- Usare `playerDevelopmentRepository.ts` per obiettivi, evidenze e review.
- Non salvare timeline derivate in IndexedDB.
- Non aggiornare automaticamente `Player.rating` da evidenze, partite o allenamenti.
- Quando una feature collega sviluppo a partita/allenamento, salvare solo `matchId` o `trainingSessionId` opzionale sull'evidenza o sull'obiettivo.

In sviluppo `initializeDatabase()` stampa:

```text
[CoachField] Player seed version X - N players
```

## Test Attuali

Non esiste una suite automatica nel repository. La verifica attuale e manuale piu:

```bash
npm run lint
npm run build
```

Per una fase successiva e consigliato introdurre test unitari per utility/repository e test e2e per i flussi principali.
