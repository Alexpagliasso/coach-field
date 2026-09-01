# Features

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
- promuovere un ospite a rosa
- salvare osservazioni rapide
- salvare note testuali positive o di attenzione
- segnare "Interessante in porta"
- registrare note vocali
- consultare cronologia osservazioni e vocali del giocatore

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

## Temi

Il selettore Tema nel layout apre una bottom sheet con:

- Pitch
- Electric Blue
- Purple Data
- Ice Cyan

Il cambio tema e immediato e persistente dopo refresh/riapertura.

## PWA

La configurazione `vite-plugin-pwa` genera manifest e service worker in build. L'app e installabile e precachea asset statici.
