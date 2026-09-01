# Development Guide

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
