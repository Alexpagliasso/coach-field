# Roadmap

## Roadmap aggiornata

V5A: foundation multi-staff, Auth, organizzazioni/gruppi, RLS, permessi, binding locale, backup e test. V1?V4 restano la base funzionale.

V5B, non implementata: dati sportivi canonici condivisi su Supabase; migrazione consensuale e verificata del legacy; IndexedDB come cache offline; upload audio privato; code operazioni, conflitti, revoche e recupero; policy sportive per ogni gruppo. Nessun sync improvvisato in V5A.

V6, non implementata: Parent Portal, associazione famiglia/minore, report e comunicazioni. Redesign, AI e report avanzati restano fuori da questo recovery.

## Riferimento storico V1?V4

Le sezioni seguenti descrivono il checkpoint recuperato. Dove differiscono su routing, Auth, backend, seed o test, prevale lo stato V5A sopra.

## Stato Attuale

Coach Field e un MVP locale/mobile-first. Funziona per gestire template e sessioni allenamento, raccogliere dati individuali durante l'allenamento, tracciare partite con valutazioni giocatore e seguire lo sviluppo qualitativo dei singoli.

## Priorita Alta

- Aggiungere test automatici per utility critiche:
  - adattamento ai presenti;
  - migrazione seed;
  - duplicati giocatore;
  - repository IndexedDB.
- Aggiungere compressione o gestione piu avanzata per backup con molte note vocali.
- Raffinare la gestione partite:
  - marcatori e assist;
  - minuti giocati;
  - formazioni;
  - statistiche sintetiche per squadra e giocatore.
- Raffinare la gestione allenamenti:
  - editor esercizi piu ricco;
  - duplicazione sessione come nuovo allenamento;
  - filtri avanzati storico;
  - report sessione.
- Aggiungere export leggibile per colloqui/genitori/staff:
  - report giocatore;
  - report seduta;
  - riepilogo portieri.
- Raffinare il player development:
  - trend visuali per obiettivi;
  - reminder sugli obiettivi aperti;
  - report sviluppo giocatore.

## Priorita Media

- Ricerca e filtri piu avanzati sulle note.
- Dashboard aggregata per giocatore.
- Storico presenze per piu sedute.
- Migliorare accessibilita keyboard/focus nei bottom sheet.
- Aggiungere stato update PWA visibile quando arriva una nuova versione.

## Priorita Bassa

- Sincronizzazione cloud.
- Account e ruoli utente.
- Import/export CSV.
- Libreria esercizi indipendente dai template.
- Statistiche aggregate e grafici.

## Non Obiettivi Attuali

- Gestionale societa completo.
- Pianificazione stagione completa.
- Pagamenti, iscrizioni o documenti amministrativi.
- Chat o comunicazioni con genitori.
