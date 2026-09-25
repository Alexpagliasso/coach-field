# V5A Recovery Report

Data verifica finale: 25 settembre 2026.

1. **Stato iniziale:** SPA React 19/TypeScript/Vite, React Router, PWA, temi e repository IndexedDB; nessun backend, Auth, organizzazione, gruppi o permessi.
2. **V1–V4 confermate:** Today, Players/Player Detail, presenze, osservazioni, vocali, Matches/evaluation, Training/templates/session/evaluation, Player Development con obiettivi/evidenze/review/timeline e backup/restore. IndexedDB era versione 5 con i 13 store documentati.
3. **File creati:** `.env.example`; moduli `src/auth`, `src/cloud`, `src/groups`, `src/lib`; modelli staff; pagine accesso/admin/staff; guard UI/error boundary; adapter e binding locali; migration SQL; setup Supabase; configurazioni/test Vitest e Playwright; questo report.
4. **File modificati:** entry point/routing/layout, pagine e componenti V1–V4 per routing scoped e azioni per permesso, repository locali, backup, tipi dominio, PWA/brand, CSS, package manifest, README e tutti i documenti 01–12.
5. **Dipendenze:** runtime `@supabase/supabase-js`; sviluppo `vitest`, `fake-indexeddb`, `@playwright/test`, `@electric-sql/pglite`.
6. **IndexedDB:** resta versione **5**. Il mapping usa lo store `appState`; nessun nuovo store, clear automatico o reset. L'inizializzazione non sostituisce più una rosa/seduta esistente. Le nuove installazioni non caricano la rosa privata del vecchio seed.
7. **Schema Supabase:** `profiles`, `organizations`, `organization_memberships`, `groups`, `group_memberships`, `collaborator_permissions`; FK composta gruppo/società, indici, vincoli, timestamp e trigger profilo.
8. **Migration:** `supabase/migrations/202609230001_v5a_foundation.sql`, transazionale e documentata in `docs/v5a-supabase-setup.md`.
9. **RLS:** abilitata su tutte le tabelle V5A; grant espliciti; helper privati; admin per società; coach solo sul gruppo; collaborator senza auto-promozione, auto-assegnazione o modifica dei propri override; endpoint pubblico a proiezione stretta.
10. **AuthProvider:** unico client, session restore/event listener, refresh SDK, profilo, stati loading/error, login e logout locale senza cancellare IndexedDB.
11. **GroupProvider:** gruppi disponibili, gruppo attivo, membership, ruolo, permessi, reload e cambio gruppo; invalida l'accesso locale durante il cambio.
12. **Organization:** modello non hardcoded e membership admin organization-level.
13. **Group:** modello completo con stagione, descrizione, anni, visibilità pubblica e `active`.
14. **Membership:** ruoli group-level coach/collaborator; lo stesso utente può avere ruoli diversi; admin separato a livello società.
15. **Permessi:** resolver puro centrale, default admin/coach/collaborator, override positivi/negativi e non-delegabili `staff.manage`, `group.settings`, `data.manage`.
16. **Admin:** vede i gruppi della società anche senza membership, crea/modifica/disattiva, assegna coach/collaborator e gestisce permessi.
17. **Coach:** pieno controllo tecnico sul gruppo assegnato e gestione dei soli collaborator del gruppo; non può promuoversi o operare su altri gruppi.
18. **Collaborator:** letture conservative e creazione note di default; azioni aggiuntive solo con override delegabili; controlli UI e repository.
19. **Home pubblica:** route `/`, UI minimale e directory RPC con soli metadati esplicitamente pubblici; nessun accesso al dataset sportivo.
20. **Login:** route `/login`, email/password, errori leggibili per env mancante, credenziali, rete/sessione e profilo mancante; nessun signup.
21. **Selettore:** `/app/groups`, soli gruppi accessibili con ruolo ed entrata; collegamento admin quando applicabile.
22. **Routing:** pagine esistenti montate sotto `/app/:groupId/*`; deep link protetti da Auth, accesso gruppo, binding locale e permission guard.
23. **Staff:** `/app/:groupId/staff`, allenatori/collaboratori, assegnazione staff registrato, attivazione/disattivazione e UI override collaborator.
24. **Binding legacy:** singolo `LocalGroupBinding` esplicito e atomico; richiede `group.settings`; nessuna assegnazione automatica o riassegnazione UI.
25. **Prevenzione leakage:** gruppo non bound mostra empty state; adapter filtra record legacy/`groupId`, letture per ID, filtri repository e backup; handle pendenti vengono invalidati.
26. **Backup:** conserva mapping, app state, tema e audio; filtra per gruppo; rifiuta backup foreign prima delle scritture; restore transazionale; nessun token/password/chiave. Backup legacy resta accettato e richiede nuova associazione se privo di mapping.
27. **Regressioni V1–V4:** test repository per player, Today/sessione, presenze, osservazioni, vocali, match/evaluation, training/template/evaluation, development/timeline e backup; smoke browser delle pagine principali e tab profilo.
28. **Build:** `npm run build` passa; genera bundle, manifest, `sw.js` e Workbox con 8 asset precache.
29. **Lint:** `npm run lint` passa senza errori.
30. **Smoke:** 7 Playwright test passano: home/login/env, protected redirect, login mock, binding, pagine V1–V4, cambio gruppo senza leak, logout, collaborator/admin, credenziali errate, profilo/rete/deep-link negati. 25 test Vitest passano, inclusi SQL/RLS reali su PGlite.
31. **Non testato:** login/refresh/JWT/PostgREST su un progetto Supabase reale, applicazione remota della migration, microfono reale, iOS/Safari/standalone e condivisione fra dispositivi. Non viene dichiarato login reale testato.
32. **Known issues:** un solo dataset locale per browser; IndexedDB non cifrato; bootstrap account/admin fuori app; rete richiesta per rivalidare accesso; restore sostitutivo; audio backup grande; vecchio seed privato ancora nella storia/repository ma escluso dal bundle.
33. **TODO V5B:** tabelle sportive cloud, migrazione consensuale del legacy, Supabase canonico, IndexedDB cache, sync/offline queue/conflitti/revoche e storage audio privato. Nessun elemento V5B è stato implementato.
34. **Git:** nessun commit, push, reset, clean o modifica remote. Il diff tracked finale è 55 file, 1097 inserimenti e 358 rimozioni; i nuovi file non tracciati sono elencati da `git status`. Commit suggerito: `feat: restore V5A multi-staff foundation`.

## Esito comandi

```text
npm test       PASS — 3 file, 25 test
npm run test:e2e PASS — 7 test Chromium
npm run build  PASS — PWA/service worker generati
npm run lint   PASS
git diff --check PASS (solo avvisi informativi LF/CRLF di Git su Windows)
bundle privacy scan PASS — nessun nome del seed, token o service-role nel dist
```
