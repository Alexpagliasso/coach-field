# GrowPitch Training JSON v1

Il formato canonico è `growpitch-training/v1`. È derivato dai modelli cloud reali `ExerciseLibraryItem`, `CloudTrainingSession` e `TrainingSessionExercise`. Non contiene ID persistenti di nuove entità, `organizationId`, `groupId`, visibilità o metadati database.

## Struttura

```json
{
  "format": "growpitch-training/v1",
  "mode": "exercises",
  "exercises": []
}
```

`mode` è `exercises`, `sessions` o `bundle`. `exercises` richiede solo esercizi, `sessions` solo sedute, `bundle` entrambi. Gli array supportano uno o più elementi. Il limite è 1 MB.

### Esercizio

Obbligatori: `ref`, `name`, `objective`, `shortDescription`. Opzionali: `detailedDescription`, `suggestedDurationMinutes` (1–480), `suggestedPlayerCount` (1–100), `materials`, `tags`, `category`, `sourceCollection`, `sourceId`. `ref` è locale al file, unico e non viene salvato come ID applicativo. Le categorie attualmente offerte dalla UI sono `individual-technique`, `perception-decision`, `possession-collaboration`, `duels-transitions`, `finishing`, `games-themed`; categorie/tag già supportati dal modello restano stringhe per evitare perdita dati.

```json
{
  "ref": "rondo-4v1",
  "name": "Rondo 4v1",
  "objective": "Possesso e orientamento",
  "shortDescription": "Quattro esterni contro un recuperatore.",
  "detailedDescription": "Quadrato 10x10; chi perde entra.",
  "suggestedDurationMinutes": 15,
  "suggestedPlayerCount": 5,
  "materials": ["Palloni", "Cinesini"],
  "tags": ["possesso", "passaggio"],
  "category": "possession-collaboration"
}
```

### Seduta pianificata

Obbligatori: `ref`, `kind` (`planned`), `date` (`YYYY-MM-DD`, data locale), `title`, `objective`, `durationMinutes` (1–480), `exercises`. Opzionali: `startTime`, `notes`, `status` (`planned` o `completed`). Il modello cloud non possiede entità bozza o template: una seduta importata è una seduta pianificata nel WorkGroup attivo. Date e ore non sono convertite di fuso.

Ogni voce esercizio conserva obbligatoriamente lo snapshot: `snapshotName`, `snapshotObjective`, `snapshotDescription`, `durationMinutes`; `coachNotes` è opzionale. `existingExerciseId` collega in modo esplicito un esercizio già presente nell'organizzazione attiva. In un bundle, `exerciseRef` punta al `ref` locale di un esercizio; i due riferimenti sono mutuamente esclusivi.

```json
{
  "ref": "seduta-1",
  "kind": "planned",
  "date": "2026-10-29",
  "startTime": "18:00",
  "title": "Possesso e superiorità",
  "objective": "Trovare l'uomo libero",
  "durationMinutes": 75,
  "notes": "Progressione semplice",
  "status": "planned",
  "exercises": [{
    "exerciseRef": "rondo-4v1",
    "snapshotName": "Rondo 4v1",
    "snapshotObjective": "Possesso e orientamento",
    "snapshotDescription": "Quadrato 10x10; chi perde entra.",
    "durationMinutes": 15,
    "coachNotes": "Corpo aperto"
  }]
}
```

### Bundle

```json
{
  "format": "growpitch-training/v1",
  "mode": "bundle",
  "exercises": [{ "ref": "rondo-4v1", "name": "Rondo 4v1", "objective": "Possesso", "shortDescription": "4 contro 1" }],
  "sessions": [{ "ref": "seduta-1", "kind": "planned", "date": "2026-10-29", "title": "Possesso", "objective": "Uomo libero", "durationMinutes": 60, "exercises": [{ "exerciseRef": "rondo-4v1", "snapshotName": "Rondo 4v1", "snapshotObjective": "Possesso", "snapshotDescription": "4 contro 1", "durationMinutes": 15 }] }]
}
```

## Regole di importazione

- Il parser segnala campo ed elemento per errori, riferimenti mancanti, ref duplicati e campi sconosciuti; questi ultimi non vengono persi in silenzio.
- HTML attivo, handler `on*`, URL `javascript:` e tag script/iframe/object/embed/style sono rifiutati.
- Il file viene validato e mostrato in anteprima prima di ogni scrittura.
- Gli ID delle nuove entità sono creati dai repository. Il gruppo non è accettato dal JSON: è sempre il WorkGroup attivo e autorizzato dalla UI/RLS.
- I duplicati esercizio sono confrontati tramite sorgente esterna oppure nome e obiettivo normalizzati. Non avviene alcuna sovrascrittura automatica.
- Export e import preservano tutti i campi supportati dai tre modelli sopra, inclusi gli snapshot.

## Limiti e incompatibilità

Il repository attuale non offre una transazione client atomica che comprenda creazione esercizi e RPC seduta. Per questo il bundle viene validato ma non persistito in blocco dalla UI: va importata prima la parte esercizi e poi la seduta con riferimenti verificabili. L'archivio sedute esporta la pagina caricata (12 elementi), non l'intero archivio paginato. Non esistono template/bozze nel modello cloud corrente. Non vengono importati dati di un altro gruppo, backup o record IndexedDB.

## Prompt per ChatGPT

> Genera esclusivamente JSON valido nel formato `growpitch-training/v1`. Usa `mode` exercises, sessions o bundle. Non inventare ID database, organizationId o groupId. Assegna `ref` locali unici. Per ogni esercizio includi name, objective e shortDescription; durata 1–480 e giocatori 1–100. Per ogni seduta usa kind planned, data locale YYYY-MM-DD, durata 1–480 e snapshot completi per ciascun esercizio. Nei bundle collega gli esercizi con exerciseRef. Non inserire HTML. Non aggiungere campi fuori schema.

## Icona iOS

`public/apple-touch-icon.png` è un PNG valido 180×180, collegato prima del manifest tramite `rel="apple-touch-icon"`; `vite-plugin-pwa` lo include nel build. Dopo il deploy, per forzare l'aggiornamento su iPhone: rimuovere GrowPitch dalla schermata Home, chiudere Safari, riaprire il sito e usare Condividi → Aggiungi alla schermata Home. La verifica su Safari reale richiede un iPhone e non è coperta dai test automatici.
