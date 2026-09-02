# Decisions

## ADR 001 - Local-First MVP

Decisione: usare IndexedDB locale come persistenza principale.

Motivazione: l'app deve funzionare sul campo, anche con rete instabile o assente. Evitare backend riduce tempi e complessita dell'MVP.

Conseguenze:

- Dati disponibili offline sullo stesso browser/dispositivo.
- Nessuna sincronizzazione tra dispositivi.
- Backup/export diventa importante.

## ADR 002 - Repository Layer

Decisione: isolare IndexedDB in `src/db`.

Motivazione: mantenere la UI indipendente dai dettagli dello storage e rendere piu semplice cambiare persistenza in futuro.

Conseguenze:

- Pagine e componenti chiamano funzioni repository.
- Le migrazioni restano centralizzate in `db.ts`.

## ADR 003 - Seed Versioning

Decisione: versionare il seed giocatori con `PLAYER_SEED_VERSION`.

Motivazione: IndexedDB mantiene dati vecchi; senza versioning l'app puo continuare a mostrare seed obsoleti.

Conseguenze:

- All'avvio si puo migrare la rosa senza cancellare tutto il database.
- Bisogna incrementare la versione quando cambia struttura/dati seed importanti.

## ADR 004 - Bottom Sheet Mobile

Decisione: usare bottom sheet per dettagli, presenze, aggiunta giocatore, adattamento e temi.

Motivazione: su iPhone mantiene il contesto e usa un pattern naturale per interazioni rapide.

Conseguenze:

- Componenti modali condividono CSS e comportamento Escape/backdrop.
- Serve attenzione a z-index e scroll interno.

## ADR 005 - Theme In LocalStorage

Decisione: salvare il tema in `localStorage`.

Motivazione: il tema deve essere letto prima del render React per evitare flash del tema default.

Conseguenze:

- Il tema non passa da IndexedDB.
- In caso di localStorage non disponibile, il provider mantiene comunque il tema in memoria.

## ADR 006 - Nessuno State Manager Globale

Decisione: usare solo React state/context.

Motivazione: il dominio MVP e ancora contenuto; un global store avrebbe aggiunto complessita non necessaria.

Conseguenze:

- Alcune pagine espongono funzioni `refresh()`.
- Potrebbe servire un layer stato piu strutturato se arrivano multi-seduta, sync o dashboard.

## ADR 007 - MediaRecorder Browser-Native

Decisione: registrare audio con `navigator.mediaDevices` e `MediaRecorder`.

Motivazione: evita librerie esterne e funziona con capability native del browser.

Conseguenze:

- La disponibilita dipende dal browser e dai permessi microfono.
- Serve gestire fallback quando non disponibile.

## ADR 008 - TrainingTemplate vs TrainingSession Snapshot

Decisione: separare i template riutilizzabili dalle sessioni realmente svolte. Quando una sessione nasce da un template, le fasi vengono copiate come snapshot dentro `TrainingSession.plannedPhases`.

Motivazione: lo storico non deve cambiare quando un template viene modificato in futuro.

Conseguenze:

- Le sessioni sono piu consistenti e consultabili offline.
- Esiste una duplicazione intenzionale tra template e sessione.
- Le modifiche a un template non aggiornano sessioni gia create.

## ADR 009 - Player Development Qualitativo

Decisione: modellare sviluppo giocatore con obiettivi, evidenze e review qualitative, senza ranking globale e senza aggiornare automaticamente `Player.rating`.

Motivazione: nel calcio giovanile il valore principale e ricordare comportamenti osservabili e progressi contestuali. Un punteggio automatico rischierebbe di sembrare piu oggettivo di quanto sia.

Conseguenze:

- Le evidenze usano outcome semplici: positivo, misto, attenzione.
- Le medie partita/allenamento restano letture storiche separate.
- Il giudizio generale del profilo resta manuale.

## ADR 010 - Review Come Snapshot

Decisione: salvare `PlayerDevelopmentReview` come fotografia periodica di rating generale, punti di forza, aree da sviluppare e ruoli suggeriti.

Motivazione: una review deve rappresentare cio che lo staff pensava in una data precisa. Se domani cambiano rating o ruoli ideali, la review storica non deve mutare.

Conseguenze:

- Le review possono alimentare timeline e storico ruoli.
- Non sostituiscono gli obiettivi attivi.
- La modifica futura di una review richiederebbe UI dedicata, non ancora implementata.
