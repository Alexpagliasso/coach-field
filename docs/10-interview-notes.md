# Interview Notes

## Pitch Tecnico

Coach Field e una PWA React/TypeScript offline-first pensata per un caso d'uso reale: supportare un allenatore di calcio giovanile durante allenamenti e partite. La priorita progettuale e ridurre il carico cognitivo sul campo: pochi tap, bottom sheet, dati locali e UI mobile-first.

## Problema Di Prodotto

L'allenatore deve:

- ricordare esercizi e consegne;
- gestire presenze;
- osservare bambini diversi;
- salvare note rapide;
- adattare i formati quando il numero di presenti cambia.
- valutare i giocatori anche in partita senza confondere dati gara e valutazione generale.
- riutilizzare template senza perdere lo storico reale delle sessioni svolte.
- seguire obiettivi qualitativi individuali senza trasformare bambini in classifiche.

Coach Field unifica questi bisogni in un'app installabile, senza backend.

## Scelte Architetturali Da Spiegare

- Repository layer sopra IndexedDB per isolare la persistenza.
- Seed versioning per evitare reset manuali del database.
- Local-first per funzionare sul campo anche senza connessione.
- PWA per installazione e caching asset.
- CSS variables per supportare temi senza duplicare componenti.
- Bottom sheet per mantenere contesto su mobile.

## Trade-Off Consapevoli

- Nessun backend: meno complessita e piu affidabilita offline, ma niente sync multi-device.
- Nessuno state manager globale: codice piu semplice per MVP, ma refresh manuali dopo alcune operazioni.
- Una seduta seedata: ottima per validare il flusso, non ancora un planner completo.
- Backup JSON completo: utile per mettere al sicuro dati locali e audio prima di evoluzioni importanti.
- Gestione partite separata dalle sedute: le valutazioni gara hanno store dedicato e non sovrascrivono il profilo tecnico manuale.
- Template e sessione snapshot: duplicazione intenzionale dei dati del programma per preservare lo storico.
- Player development qualitativo: obiettivi, evidenze e review aiutano la memoria dell'allenatore senza produrre ranking o voti automatici.

## Cosa Mostrare In Demo

1. Aprire `Oggi`.
2. Cambiare fase con F1-F5.
3. Aprire dettaglio esercizio.
4. Gestire presenze e vedere aggiornare adattamento.
5. Aggiungere un ospite.
6. Aprire profilo giocatore.
7. Assegnare rating e ruoli ideali.
8. Salvare una nota rapida.
9. Creare una partita, selezionare partecipanti e valutare un giocatore.
10. Tornare al profilo giocatore e mostrare storico/media partita.
11. Aprire Training, creare una sessione da template e valutare una fase.
12. Valutare un giocatore in allenamento e mostrare la media allenamenti nel profilo.
13. Aprire tab Obiettivi, creare un obiettivo e segnare una evidenza rapida.
14. Aprire Timeline e mostrare che deriva da partite, allenamenti, note, obiettivi e review.
15. Cambiare tema e fare refresh.
16. Mostrare archivio note e backup.

## Possibili Domande

Come funziona offline?

Risposta: asset statici via service worker generato da Vite PWA; dati applicativi in IndexedDB tramite repository.

Come gestisci migrazioni?

Risposta: per ora la migrazione principale riguarda il seed giocatori. `playerSeedVersion` viene salvato in `appState`; se aumenta, `initializeDatabase()` aggiorna i dati senza cancellare sessioni e note.

Come hai modellato le partite?

Risposta: `Match` e `MatchPlayerEvaluation` sono store separati. La partita contiene metadati, risultato e note squadra; la valutazione giocatore contiene partecipazione, titolare, ruoli giocati, rating, tag e nota individuale.

Perche template e sessione non condividono sempre le stesse fasi?

Risposta: la sessione deve essere una fotografia dell'allenamento pianificato per quel giorno. Se cambio il template dopo un mese, non voglio alterare lo storico di cio che avevo programmato o svolto.

Perche localStorage per il tema?

Risposta: serve applicare il tema prima del render React per ridurre il flash visivo. I dati applicativi restano in IndexedDB.

Come miglioreresti il progetto?

Risposta: test automatici, gestione multi-seduta, statistiche partita piu ricche, trend visuali sugli obiettivi, compressione backup audio, sync opzionale e report esportabili.

Perche niente punteggio globale sviluppo?

Risposta: il dominio e calcio giovanile. Il sistema deve aiutare l'allenatore a osservare progressi e contesti, non creare classifiche implicite tra bambini. Per questo obiettivi ed evidenze restano qualitativi.
