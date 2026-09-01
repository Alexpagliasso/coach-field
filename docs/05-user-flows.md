# User Flows

## Avvio App

1. L'utente apre l'app.
2. Lo script in `index.html` applica subito il tema salvato.
3. React monta l'app.
4. `App.tsx` chiama `initializeDatabase()`.
5. Se il database e pronto, viene mostrata la route corrente.
6. Se IndexedDB fallisce, appare una schermata errore.

## Seguire Una Seduta

1. L'utente apre `Oggi`.
2. Consulta fase corrente, timer e contenuto.
3. Avvia o mette in pausa il timer.
4. Passa alla fase successiva con `Succ.` o usa F1-F5.
5. Tocca un esercizio per aprire il dettaglio.
6. Registra una nota vocale se serve.

## Gestire Presenze

1. Da `Oggi`, l'utente tocca `Gestisci presenze`.
2. Apre la bottom sheet presenze.
3. Spunta o deseleziona i giocatori.
4. Usa `Tutti presenti` o `Azzera` se serve.
5. Chiude il foglio.
6. Il conteggio presenti aggiorna automaticamente gli adattamenti.

## Aggiungere Un Ospite Durante L'Allenamento

1. Da presenze, l'utente tocca `Giocatore`.
2. Inserisce nome, anno e opzionalmente cognome/ruoli/rating.
3. Lascia attivo `Segna come presente oggi`.
4. Salva.
5. L'ospite viene persistito in IndexedDB e segnato presente.
6. La lista presenze e la rosa vengono aggiornate.

## Gestire Duplicati

1. L'utente inserisce dati simili a un giocatore esistente.
2. Il modale mostra `Esiste gia un giocatore con questi dati`.
3. L'utente puo usare il giocatore esistente o aggiungere comunque un nuovo record.

## Valutare Un Giocatore

1. Da `Giocatori`, l'utente apre il profilo.
2. Tocca le stelle per assegnare un valore anche a mezze stelle.
3. Il valore viene salvato subito.
4. Puo rimuovere la valutazione.

## Impostare Ruolo Ideale

1. Da profilo, l'utente tocca uno o piu chip ruolo.
2. I chip selezionati cambiano stato visivo e vengono salvati.
3. La pagina giocatori mostra la sintesi dei ruoli ideali.

## Gestire Una Partita

1. L'utente apre `Partite`.
2. Tocca `Nuova partita`.
3. Inserisce data, avversario, tipo partita, casa/trasferta/neutro ed eventuali dettagli.
4. Salva e viene portato al dettaglio partita.
5. Seleziona i partecipanti dalla rosa.
6. Apre la scheda di un giocatore per valutarlo.
7. Inserisce rating, ruoli giocati, titolare, tag, note o nota vocale.
8. Inserisce risultato, valutazione squadra e note staff.
9. Tocca `Completa partita` e conferma il riepilogo.

## Consultare Storico Partita Giocatore

1. L'utente apre un profilo da `Giocatori`.
2. La sezione `Partite` mostra presenze, valutazioni e media partita.
3. Tocca una partita recente per tornare al dettaglio match.

## Salvare Osservazioni

1. Nel profilo giocatore, l'utente sceglie una categoria rapida.
2. L'app salva un'osservazione positiva.
3. Con la nota testuale puo salvare testo come positivo o attenzione.
4. La cronologia del profilo si aggiorna.

## Registrare Una Nota Vocale

1. L'utente tocca `Nota vocale`.
2. Il browser chiede permesso microfono se necessario.
3. L'app registra tramite MediaRecorder.
4. L'utente tocca stop.
5. Il blob audio viene salvato in IndexedDB.

## Cambiare Tema

1. L'utente tocca `Tema`.
2. Apre la bottom sheet aspetto.
3. Tocca una card tema.
4. Il tema cambia immediatamente.
5. La scelta viene salvata in `localStorage`.
6. Dopo refresh o riapertura resta lo stesso tema.

## Backup E Restore

1. Da `Note`, l'utente puo esportare un backup JSON.
2. Il backup contiene giocatori, osservazioni, sedute, presenze, partite, valutazioni partita, impostazioni, tema e note vocali con audio base64.
3. Il restore chiede conferma con `window.confirm`.
4. Il restore sostituisce gli store applicativi inclusi nel backup completo.

Nota: i backup generati dal nuovo export includono i blob audio in formato Data URL base64.
