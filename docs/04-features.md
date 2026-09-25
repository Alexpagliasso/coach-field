# Features

## Funzioni aggiunte in V5A

Home pubblica minimale, login email/password senza signup, ripristino sessione SDK, selettore gruppi, topbar nome/ruolo/cambio gruppo/logout. Admin: crea, modifica e disattiva gruppi; assegna staff esistente anche come coach. Coach: gestisce collaboratori del proprio gruppo. Collaborator: letture conservative e creazione note, con override delegabili.

Staff mostra allenatori/collaboratori e checkbox permessi. Associazione locale esplicita, empty state per gruppi non associati, backup con mapping e nessuna migrazione sportiva cloud. Le capacit? precedenti sotto descritte sono conservate nel nuovo percorso /app/:groupId.

## Riferimento storico V1?V4

Le sezioni seguenti descrivono il checkpoint recuperato. Dove differiscono su routing, Auth, backend, seed o test, prevale lo stato V5A sopra.

## Seduta Corrente

La home mostra la seduta seedata "Primo allenamento 2016/2017" con durata totale, fase corrente e timer.

Azioni presenti:

- Avvia fase
- Pausa
- Fine
- Succ.
- Reset
- salto diretto tra fasi F1-F5

## Fasi Ed Esercizi

Le fasi possono avere descrizioni, sequenze, obiettivi, sezioni e campi. Gli esercizi della Fase 2 e della Fase 3 si aprono in una bottom sheet con contenuto dettagliato.

## Adattamento Ai Presenti

Per Fase 2, Fase 3 e Fase 4 l'app calcola un adattamento operativo in base al numero di presenti.

La card mostra sintesi immediata; la bottom sheet mostra:

- numero presenti
- distribuzione consigliata
- formato per campo
- focus pedagogico
- dimensioni indicative
- rotazioni/cambi/jolly

## Presenze

Il foglio presenze consente di:

- vedere presenti / totale
- segnare un singolo giocatore
- impostare tutti presenti
- azzerare tutti
- aggiungere rapidamente un ospite

Gli ospiti aggiunti dalle presenze possono essere segnati presenti subito.

## Rosa

La pagina Giocatori mostra:

- conteggio giocatori
- ricerca per nome/ruolo
- filtri: Tutti, 2016, 2017, POR, DIF, CEN, ATT, JOLLY
- filtro Obiettivi attivi
- ordinamento per nome, valutazione e anno
- rating sintetico
- ruoli ideali
- badge ospite

## Aggiunta Rapida Giocatore

`AddPlayerModal` crea un giocatore con:

- nome obbligatorio
- cognome opzionale
- anno 2016, 2017 o Altro
- ruoli storici multipli
- rating opzionale
- ruoli ideali multipli
- presenza odierna opzionale quando aperto dalle presenze

Il controllo duplicati confronta nome, cognome e anno. Se trova un match mostra scelta tra usare l'esistente o aggiungere comunque.

## Profilo Giocatore

Il profilo consente di:

- vedere dati base e fase corrente
- modificare valutazione a stelle
- impostare ruoli ideali
- consultare storico partite, rating partita, ruoli giocati e media partita
- consultare storico allenamenti, media allenamenti e presenze allenamento
- consultare Panoramica, Timeline, Obiettivi e Storico
- creare obiettivi individuali di sviluppo
- segnare evidenze rapide sugli obiettivi attivi
- creare review periodiche con punti di forza, aree da sviluppare e ruoli suggeriti
- promuovere un ospite a rosa
- salvare osservazioni rapide
- salvare note testuali positive o di attenzione
- segnare "Interessante in porta"
- registrare note vocali
- consultare cronologia osservazioni e vocali del giocatore

## Partite

La pagina Partite consente di:

- vedere partite prossime e passate
- filtrare per Tutte, Campionato, Torneo e Amichevoli
- creare una nuova partita con data, avversario, tipo, casa/trasferta/neutro, competizione e luogo
- aprire il dettaglio partita

Nel dettaglio partita sono implementati:

- risultato modificabile
- valutazione squadra a mezze stelle
- note staff
- note vocali associate alla partita
- appunti "Da portare in allenamento"
- selezione partecipanti con azioni Tutti/Nessuno
- scheda valutazione per singolo giocatore con rating, ruoli giocati, titolare, tag e nota
- check rapido degli obiettivi attivi del giocatore
- creazione obiettivo dal contesto partita
- completamento partita con conferma riepilogativa
- modifica anche dopo completamento
- eliminazione partita con cancellazione delle valutazioni associate

## Allenamenti V3

La pagina `Training` consente di:

- vedere sessioni prossime/oggi
- consultare storico sessioni completate
- cercare template per titolo o tag
- creare sessioni da zero
- creare sessioni da template
- creare, modificare, duplicare ed eliminare template

Nel dettaglio sessione sono implementati:

- presenze con lo stesso sistema `Attendance` esistente
- programma a timeline con stato fase
- dettaglio fase in bottom sheet
- rating fase a mezze stelle
- stato fase: fatto, modificato, saltato
- durata reale, nota staff e variante usata
- lista giocatori presenti
- valutazione allenamento per giocatore con rating, ruoli provati, tag e nota
- check rapido degli obiettivi attivi del giocatore
- creazione obiettivo dal contesto allenamento
- note vocali collegate alla sessione o al giocatore
- note allenamento e campo "Da riprendere"
- collegamento informativo ai takeaways dell'ultima partita
- completamento allenamento con riepilogo e warning non bloccante
- eliminazione sessione con rimozione di presenze, valutazioni e note collegate

## Portieri

La pagina Portieri permette di:

- selezionare un giocatore
- attivare/disattivare `goalkeeperCandidate`
- aggiungere tag di osservazione portiere
- vedere osservazioni portiere e note vocali associate al giocatore selezionato

## Note

La pagina Note mostra:

- filtro per giocatore
- filtro per fase
- recorder vocale nel contesto selezionato
- vocali recenti con playback e cancellazione
- note testuali recenti
- export backup JSON completo con audio base64
- restore backup JSON

## Player Development V4

La V4 aggiunge uno spazio qualitativo nel profilo giocatore:

- obiettivi individuali con categoria, priorita e stato
- evidenze positive, miste o di attenzione
- collegamento opzionale a partita o sessione allenamento
- review periodiche come snapshot
- timeline derivata da partite, allenamenti, osservazioni, note vocali, obiettivi, evidenze e review
- storico ruoli derivato da ruoli giocati, ruoli provati e review

Non sono implementati ranking tra giocatori, punteggi globali automatici o aggiornamenti automatici di `Player.rating`.

## Temi

Il selettore Tema nel layout apre una bottom sheet con:

- Pitch
- Electric Blue
- Purple Data
- Ice Cyan

Il cambio tema e immediato e persistente dopo refresh/riapertura.

## PWA

La configurazione `vite-plugin-pwa` genera manifest e service worker in build. L'app e installabile e precachea asset statici.
