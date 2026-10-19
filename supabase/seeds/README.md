# Seed dimostrativo GrowPitch

`202610160001_torino_nord_academy_demo.sql` crea esclusivamente **Torino Nord Academy — DEMO** con slug `torino-nord-academy-demo`. Richiede le migration 020 e 023: popola infatti i tag tecnici e una cronologia Live sintetica coerente con i risultati delle partite.

1. Apri Supabase SQL Editor con un account amministratore del progetto.
2. In Supabase Dashboard apri **Authentication → Users**, scegli lo staff autorizzato alla demo e copia il suo UUID. Il seed non crea utenti Auth né ricerca o esporta altri profili.
3. Sostituisci il valore di `app.demo_admin_profile_id` nel file con quell'UUID.
4. Revisiona il file, quindi eseguilo manualmente in un'unica transazione. Se il profilo ha già una membership demo non attiva o non amministrativa, il seed si interrompe senza modificarla.
5. Esegui le query read-only in fondo al file: devono restituire 24 giocatori, 6 esercizi, 6 allenamenti e 4 partite.
6. Accedi a GrowPitch con lo staff scelto e seleziona **Torino Nord Academy — DEMO**.

Il file non contiene dati di Auxilium Monterosa, non consulta organizzazioni diverse dalla demo e non esegue cancellazioni. Una seconda esecuzione inserisce solo i record demo mancanti; in presenza di duplicati o assegnazioni demo ambigue si interrompe per richiedere una revisione manuale.
