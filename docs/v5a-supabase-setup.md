# V5A: setup Supabase e privacy

V5A usa Supabase esclusivamente per identità e struttura staff. Non contiene tabelle cloud sportive né sincronizzazione. L'accesso ai dati sportivi riguarda ancora un solo dataset per browser, associato esplicitamente a un gruppo.

## Applicare la migration

1. Creare un progetto Supabase. Nel pannello Authentication disabilitare le nuove registrazioni pubbliche. Creare gli account staff dal pannello amministrativo (email/password). Non esiste signup o gestione inviti nell'app.
2. Eseguire **l'intero contenuto** di `supabase/migrations/202609230001_v5a_foundation.sql` nel SQL Editor del progetto, una sola volta. Il file usa una transazione; non eseguirne singoli frammenti e non rieseguirlo su uno schema già creato.
3. In alternativa, con Supabase CLI installata:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Se applicata tramite SQL Editor, prima di adottare il CLI allineare lo storico con `supabase migration repair 202609230001 --status applied` sul progetto corretto. Non applicare due volte la migration.
4. Creare società e primo admin nel SQL Editor con una sessione amministrativa. Sostituire i valori dimostrativi e usare un account già creato:

   ```sql
   begin;
   insert into public.organizations (name, slug)
   values ('La mia società', 'mia-societa');

   insert into public.organization_memberships (organization_id, user_id, role)
   select o.id, p.id, 'admin'
   from public.organizations o cross join public.profiles p
   where o.slug = 'mia-societa' and lower(p.email) = lower('admin@example.org');
   commit;
   ```

   Verificare che la seconda operazione abbia inserito una riga. Ripetere per altre società: nessun ID società è hardcoded. Assegnare ulteriori admin richiede lo stesso canale amministrativo; l'app gestisce coach e collaborator.
5. Copiare `.env.example` in `.env.local`, impostare URL progetto e anon key e riavviare Vite. Non usare service-role key nel frontend. Non committare `.env.local`. Le variabili `VITE_*` sono pubbliche nel bundle.
6. Avviare `npm run dev`, accedere su `/login`, aprire `/admin`, creare un gruppo e assegnare email staff già registrate. Il coach può assegnare solo collaboratori ai gruppi in cui è coach attivo; l'admin può assegnare anche coach.
7. Entrare nel gruppo che corrisponde realmente alla squadra del dispositivo e scegliere **Associa al gruppo attuale**. Il binding non viene scelto automaticamente e non può essere spostato dall'interfaccia. Fare un backup dal gruppo associato prima di ulteriori operazioni sui dati.

## Modello e autorizzazione

- `profiles.id` riferisce `auth.users.id`; trigger crea il profilo e aggiorna l'email, inclusi gli utenti già esistenti al momento della migration.
- `organizations`: nome, slug, logo, descrizione, timestamp.
- `organization_memberships`: admin attivi per società, senza necessità di membership in ogni gruppo.
- `groups`: società, nome, stagione, descrizione, anni, visibilità pubblica e stato attivo.
- `group_memberships`: coach/collaborator per gruppo; FK composta impedisce incoerenze fra società e gruppo.
- `collaborator_permissions`: override booleani con unicità membership/permission. I permessi strutturali non sono ammessi dal vincolo SQL.
- Tutte le tabelle hanno RLS, grant espliciti e timestamp. Gli ID e i riferimenti delle membership/override sono immutabili. Le disattivazioni sostituiscono le cancellazioni.
- Le funzioni helper sono in schema `private`, con `search_path` vuoto e privilegi limitati. Le funzioni `security definer` hanno scopo ristretto, controllano `auth.uid()` e non accettano un ID attore fornito dal client.
- `assign_group_staff` cerca una singola email solo dopo il controllo del gestore del gruppo; non espone un elenco generale degli utenti. Impedisce a un coach di modificare altri coach o se stesso.
- L'endpoint anonimo `public_group_directory` restituisce esclusivamente ID/nome/stagione/descrizione dei gruppi attivi e pubblici e nome società. Nessun accesso anonimo diretto a tabelle staff o profili.

La descrizione dei gruppi pubblici deve contenere solo informazioni pubblicabili. Non inserirvi dati di minori o note tecniche. Il vecchio file seed della rosa rimane nella storia/repository recuperata, ma non viene importato dall'app né incluso nel bundle di produzione; questa modifica non rimuove informazioni già presenti nella storia Git.

## Protezione locale e limiti

RLS protegge **il cloud**. IndexedDB non è cifrato né protetto da RLS: chi controlla il browser/dispositivo può leggerne i dati. I guard e i repository evitano visualizzazioni accidentali fra gruppi e applicano i permessi nell'app; non costituiscono isolamento crittografico tra persone che condividono un profilo browser.

`appState.localGroupBinding` salva gruppo, utente che associa e data. Non contiene sessioni o segreti. Il dataset è utilizzabile solo da utenti autorizzati al gruppo associato. Un gruppo diverso mostra empty state, anche per admin. Il logout chiude l'accesso nell'app e conserva IndexedDB. Usare profili browser separati su dispositivi condivisi.

Il backup completo conserva binding, stato corrente, versione seed, tema e audio. Non legge il localStorage di Supabase. Il ripristino verifica il gruppo prima delle scritture e usa una transazione; un backup senza binding rende il dataset nuovamente non associato. Il formato legacy parziale resta accettato, ma non può recuperare audio che non conteneva. Il ripristino sostituisce gli store presenti nel file, non effettua merge. Non importare backup non attendibili.

Non c'è autenticazione offline custom. La sessione è gestita dall'SDK; profilo, accesso ai gruppi e permessi richiedono rete al caricamento e alla rivalidazione. Un contesto già caricato può usare dati locali; un riavvio offline può mostrare errore leggibile e richiedere connessione. Nessuna garanzia di revoca istantanea offline. In V5B si progetteranno stato condiviso canonico in Supabase, cache IndexedDB, revoche e conflitti di sync.

## Verifiche prima dell'uso reale

Eseguire build, lint, unit/RLS test e smoke test come descritto nella guida sviluppo. I test SQL usano PostgreSQL incorporato PGlite con ruoli e `auth.uid()` simulati; i test browser intercettano Supabase con fixture. Restano da verificare sul progetto reale: login/password, refresh token, configurazione Auth, REST/PostgREST, RLS con JWT reali, assegnazione staff e policy operative. Nessuna migration è stata applicata automaticamente a un progetto remoto.

Riferimenti ufficiali: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [profili Auth](https://supabase.com/docs/guides/auth/managing-user-data), [eventi Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
