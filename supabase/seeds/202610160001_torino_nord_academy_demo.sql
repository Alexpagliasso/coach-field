-- GrowPitch demo seed: Torino Nord Academy — DEMO
--
-- Manual-only administrative script. It never reads from, copies from, or
-- modifies any organization other than the organization with this exact slug.
-- Do not run it from the browser. Run it in the Supabase SQL editor as an
-- administrator after replacing the UUID below with an existing staff profile.
-- Prerequisites: migrations 020 (objective tags) and 023 (Match Live) applied.
--
-- The script is repeatable: it only inserts missing demo records and does not
-- delete, reset, or alter records belonging to another organization.

begin;

-- REQUIRED: an existing public.profiles.id that should administer the demo.
-- Example: set local app.demo_admin_profile_id = '00000000-0000-0000-0000-000000000000';
-- The placeholder deliberately aborts the transaction if it is not replaced.
set local app.demo_admin_profile_id = '00000000-0000-0000-0000-000000000000';

do $$
declare
  v_admin_id uuid := nullif(current_setting('app.demo_admin_profile_id', true), '')::uuid;
  v_org_id uuid;
  v_team_id uuid;
  v_blu_id uuid;
  v_rosso_id uuid;
  v_session_id uuid;
  v_match_id uuid;
  v_group_id uuid;
  v_player_id uuid;
  v_position integer;
  v_slot text;
  v_x numeric;
  v_y numeric;
  v_record record;
  v_count integer;
  v_goal_index integer;
  v_scorer_id uuid;
  v_our_goals integer;
  v_opponent_goals integer;
begin
  perform pg_advisory_xact_lock(hashtext('growpitch:torino-nord-academy-demo:v1'));
  if to_regclass('public.training_objective_tags') is null
     or to_regclass('public.training_session_objective_tags') is null
     or to_regclass('public.match_live_states') is null
     or to_regclass('public.match_live_events') is null then
    raise exception 'Required migrations 020 and 023 must be applied before the demo seed';
  end if;
  if v_admin_id is null or v_admin_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Set app.demo_admin_profile_id to an existing public.profiles.id before running this seed';
  end if;
  if not exists (select 1 from public.profiles where id = v_admin_id) then
    raise exception 'The requested demo administrator profile does not exist';
  end if;

  insert into public.organizations(name, slug, description)
  values ('Torino Nord Academy — DEMO', 'torino-nord-academy-demo', 'Società dimostrativa: tutti i dati sono inventati e servono soltanto a presentare GrowPitch.')
  on conflict (slug) do nothing;

  select id into v_org_id from public.organizations where slug = 'torino-nord-academy-demo';
  if v_org_id is null then
    raise exception 'The demo organization could not be resolved';
  end if;
  if not exists (select 1 from public.organizations where id = v_org_id and name = 'Torino Nord Academy — DEMO') then
    raise exception 'Refusing to seed an organization with the demo slug but a different name';
  end if;

  insert into public.organization_memberships(organization_id, user_id, role, active)
  values (v_org_id, v_admin_id, 'admin', true)
  on conflict (organization_id, user_id) do nothing;
  if not exists (select 1 from public.organization_memberships where organization_id = v_org_id and user_id = v_admin_id and role = 'admin' and active) then
    raise exception 'The requested profile already has a non-admin or inactive demo membership; review it manually before seeding';
  end if;

  insert into public.teams(organization_id, name, season)
  select v_org_id, 'Pulcini U10', '2026/27'
  where not exists (select 1 from public.teams where organization_id = v_org_id and name = 'Pulcini U10' and season = '2026/27');
  select count(*), (array_agg(id order by id))[1] into v_count, v_team_id from public.teams where organization_id = v_org_id and name = 'Pulcini U10' and season = '2026/27';
  if v_count <> 1 then raise exception 'Expected exactly one demo Pulcini U10 team, found %', v_count; end if;

  insert into public.groups(organization_id, team_id, name, season, description, year_from, year_to, public_visible, active)
  select v_org_id, v_team_id, entry.name, '2026/27', entry.description, 2016, 2017, false, true
  from (values
    ('Blu', 'Gruppo dimostrativo Pulcini U10 — percorso tecnico e gioco associativo.'),
    ('Rosso', 'Gruppo dimostrativo Pulcini U10 — percorso tecnico e situazione di gioco.')
  ) as entry(name, description)
  where not exists (select 1 from public.groups g where g.organization_id = v_org_id and g.team_id = v_team_id and g.name = entry.name and g.season = '2026/27');
  select count(*), (array_agg(id order by id))[1] into v_count, v_blu_id from public.groups where organization_id = v_org_id and team_id = v_team_id and name = 'Blu' and season = '2026/27';
  if v_count <> 1 then raise exception 'Expected exactly one demo Blu group, found %', v_count; end if;
  select count(*), (array_agg(id order by id))[1] into v_count, v_rosso_id from public.groups where organization_id = v_org_id and team_id = v_team_id and name = 'Rosso' and season = '2026/27';
  if v_count <> 1 then raise exception 'Expected exactly one demo Rosso group, found %', v_count; end if;

  -- Ensure the demo administrator can also access both WorkGroups. Never
  -- silently change a pre-existing membership role or activation status.
  insert into public.group_memberships(organization_id, group_id, user_id, role, active)
  values (v_org_id, v_blu_id, v_admin_id, 'coach', true),
         (v_org_id, v_rosso_id, v_admin_id, 'coach', true)
  on conflict (group_id, user_id) do nothing;
  if (select count(*) from public.group_memberships
      where organization_id = v_org_id
        and group_id in (v_blu_id, v_rosso_id)
        and user_id = v_admin_id and role = 'coach' and active) <> 2 then
    raise exception 'Demo administrator must have active coach memberships in both demo groups; review conflicting memberships manually';
  end if;

  -- Exactly 24 fictional players. A player belongs to the category through
  -- team_player_memberships and to exactly one demo WorkGroup through the assignment.
  for v_record in select * from (values
    ('Alessio','Bianchi','Blu',2016), ('Dario','Colombo','Blu',2016), ('Elia','Ferrero','Blu',2016), ('Filippo','Gallo','Blu',2016),
    ('Gabriele','Leone','Blu',2016), ('Lorenzo','Marini','Blu',2016), ('Matteo','Neri','Blu',2016), ('Nicolò','Orlando','Blu',2016),
    ('Pietro','Riva','Blu',2016), ('Riccardo','Sala','Blu',2016), ('Samuele','Testa','Blu',2016), ('Tommaso','Villa','Blu',2016),
    ('Andrea','Bruni','Rosso',2016), ('Davide','Costa','Rosso',2016), ('Emanuele','Fontana','Rosso',2016), ('Francesco','Greco','Rosso',2016),
    ('Giorgio','Lombardi','Rosso',2016), ('Marco','Moretti','Rosso',2016), ('Pietro','Pagani','Rosso',2016), ('Roberto','Rossi','Rosso',2016),
    ('Simone','Serra','Rosso',2016), ('Valerio','Tosi','Rosso',2016), ('Vittorio','Valle','Rosso',2016), ('Zeno','Vitali','Rosso',2016)
  ) as data(first_name, last_name, group_name, birth_year) loop
    insert into public.players(organization_id, first_name, last_name, birth_year)
    select v_org_id, v_record.first_name, v_record.last_name, v_record.birth_year
    where not exists (select 1 from public.players where organization_id = v_org_id and first_name = v_record.first_name and last_name = v_record.last_name);
    select count(*), (array_agg(id order by id))[1] into v_count, v_player_id from public.players where organization_id = v_org_id and first_name = v_record.first_name and last_name = v_record.last_name;
    if v_count <> 1 then raise exception 'Expected exactly one demo player % %, found %', v_record.first_name, v_record.last_name, v_count; end if;

    insert into public.team_player_memberships(organization_id, team_id, player_id, status, joined_at)
    select v_org_id, v_team_id, v_player_id, 'active', date '2026-09-01'
    where not exists (select 1 from public.team_player_memberships where team_id = v_team_id and player_id = v_player_id and status = 'active');

    select count(*), (array_agg(id order by id))[1] into v_count, v_player_id from public.team_player_memberships where organization_id = v_org_id and team_id = v_team_id and player_id = (select id from public.players where organization_id = v_org_id and first_name = v_record.first_name and last_name = v_record.last_name) and status = 'active';
    if v_count <> 1 then raise exception 'Expected exactly one active category membership for % %, found %', v_record.first_name, v_record.last_name, v_count; end if;
    v_group_id := case when v_record.group_name = 'Blu' then v_blu_id else v_rosso_id end;
    insert into public.group_player_assignments(organization_id, team_id, group_id, team_player_membership_id, status, assigned_at)
    select v_org_id, v_team_id, v_group_id, v_player_id, 'active', date '2026-09-01'
    where not exists (select 1 from public.group_player_assignments where team_player_membership_id = v_player_id and status = 'active');
    if not exists (select 1 from public.group_player_assignments where team_player_membership_id = v_player_id and group_id = v_group_id and status = 'active') then
      raise exception 'Demo player % % already has a conflicting active group assignment', v_record.first_name, v_record.last_name;
    end if;
  end loop;

  insert into public.exercise_library_items(organization_id, name, objective, short_description, detailed_description, suggested_duration_minutes, suggested_player_count, materials, tags, category, source_collection, source_id, created_by)
  values
    (v_org_id, 'Rondo 4v1 a due tocchi', 'Smarcamento e velocità di trasmissione', 'Possesso palla in spazio ridotto con pressione progressiva.', 'Quadrato 12x12. Quattro giocatori mantengono il possesso contro un difendente; cambiare difendente dopo recupero o 60 secondi.', 15, 5, array['5 palloni','4 cinesini'], array['possesso','smarcamento','tecnica'], 'Possesso palla', 'torino-nord-demo-v1', 'rondo-4v1', v_admin_id),
    (v_org_id, 'Passaggi nelle porticine', 'Precisione del passaggio e orientamento', 'Coppie in movimento con obiettivo di attraversare porticine colorate.', 'Creare sei porticine. Alternare piede dominante, piede debole e ricezione orientata.', 15, 12, array['12 cinesini','6 palloni'], array['passaggio','ricezione','coordinazione'], 'Tecnica', 'torino-nord-demo-v1', 'porticine', v_admin_id),
    (v_org_id, 'Duello 2v1 con conclusione', 'Superiorità numerica e scelta finale', 'Due attaccanti affrontano un difensore e concludono in porta.', 'Partenza alternata; il portatore decide se guidare, passare o concludere. Rotazione attaccante-difensore ogni tre azioni.', 20, 9, array['1 porta','8 palloni','10 cinesini'], array['1v1','2v1','finalizzazione'], 'Situazioni di gioco', 'torino-nord-demo-v1', 'duello-2v1', v_admin_id),
    (v_org_id, 'Tre contro due alternato', 'Lettura della superiorità numerica', 'Transizione continua 3v2 con due porte e recupero immediato.', 'Tre attaccanti entrano alternati contro due difendenti. Dopo il tiro, la coppia successiva riparte dall altra porta.', 25, 10, array['2 porte','10 palloni','12 cinesini'], array['3v2','transizione','scelta'], 'Situazioni di gioco', 'torino-nord-demo-v1', 'tre-contro-due', v_admin_id),
    (v_org_id, 'Tiro ai bersagli', 'Finalizzazione e precisione', 'Conclusioni da diverse distanze verso bersagli numerati.', 'Ogni bersaglio vale un punto. Variare il lato di ricezione e la distanza di tiro.', 15, 10, array['1 porta','bersagli','8 palloni'], array['tiro','precisione','coordinazione'], 'Finalizzazione', 'torino-nord-demo-v1', 'bersagli', v_admin_id),
    (v_org_id, 'Partitella guidata 5v5', 'Principi di gioco collettivi', 'Gioco a tema con bonus per cambio lato e recupero palla alto.', 'Campo 30x22. Due tempi brevi; interrompere solo per correzioni essenziali.', 20, 10, array['2 porte','casacche','palloni'], array['partita','principi','transizione'], 'Partita a tema', 'torino-nord-demo-v1', 'partitella-5v5', v_admin_id)
  on conflict (organization_id, source_collection, source_id) do nothing;

  -- Structured objectives populate the dashboard's technical-objectives chart.
  insert into public.training_objective_tags(organization_id, name, slug, created_by)
  values
    (v_org_id, 'Possesso palla', 'possesso-palla', v_admin_id),
    (v_org_id, 'Finalizzazione', 'finalizzazione', v_admin_id),
    (v_org_id, 'Transizione', 'transizione', v_admin_id),
    (v_org_id, 'Passaggio e ricezione', 'passaggio-ricezione', v_admin_id)
  on conflict (organization_id, slug) do nothing;

  for v_record in select * from (values
    ('Blu', date '2026-09-09', 'Allenamento U10 — tecnica e possesso', 'Passaggio e smarcamento', 75),
    ('Rosso', date '2026-09-11', 'Allenamento U10 — superiorità numerica', 'Scelta e finalizzazione', 75),
    ('Blu', date '2026-09-16', 'Allenamento U10 — ricezione orientata', 'Orientamento del corpo', 75),
    ('Rosso', date '2026-09-18', 'Allenamento U10 — transizioni', 'Recupero e ripartenza', 75),
    ('Blu', date '2026-09-23', 'Allenamento U10 — finalizzazione', 'Precisione davanti alla porta', 75),
    ('Rosso', date '2026-09-25', 'Allenamento U10 — gioco collettivo', 'Ampiezza e collaborazione', 75)
  ) as data(group_name, session_date, title, objective, minutes) loop
    v_group_id := case when v_record.group_name = 'Blu' then v_blu_id else v_rosso_id end;
    insert into public.training_sessions(organization_id, group_id, session_date, title, objective, planned_duration_minutes, coach_notes, status, created_by)
    select v_org_id, v_group_id, v_record.session_date, v_record.title, v_record.objective, v_record.minutes, 'Seduta dimostrativa con dati interamente inventati.', 'completed', v_admin_id
    where not exists (select 1 from public.training_sessions where organization_id = v_org_id and group_id = v_group_id and session_date = v_record.session_date and title = v_record.title);
    select id into v_session_id from public.training_sessions where organization_id = v_org_id and group_id = v_group_id and session_date = v_record.session_date and title = v_record.title order by created_at limit 1;

    insert into public.training_session_exercises(training_session_id, exercise_id, position, snapshot_name, snapshot_objective, snapshot_description, duration_minutes, coach_notes)
    select v_session_id, e.id, row_number() over(order by e.name)::integer, e.name, e.objective, e.short_description,
      case row_number() over(order by e.name) when 1 then 20 when 2 then 25 else 30 end, 'Adatta spazi e richieste al livello del gruppo.'
    from (select * from public.exercise_library_items where organization_id = v_org_id and source_collection = 'torino-nord-demo-v1' order by name limit 3) e
    on conflict (training_session_id, position) do nothing;

    insert into public.training_session_attendance(training_session_id, organization_id, player_id, status, note, created_by)
    select v_session_id, v_org_id, membership.player_id,
      case when row_number() over(order by player.last_name, player.first_name) % 7 = 0 then 'excused' when row_number() over(order by player.last_name, player.first_name) % 5 = 0 then 'absent' else 'present' end,
      '', v_admin_id
    from public.group_player_assignments assignment
    join public.team_player_memberships membership on membership.id = assignment.team_player_membership_id
    join public.players player on player.id = membership.player_id
    where assignment.organization_id = v_org_id and membership.organization_id = v_org_id and assignment.group_id = v_group_id and assignment.status = 'active' and membership.status = 'active'
    on conflict (training_session_id, player_id) do nothing;

    insert into public.training_session_objective_tags(training_session_id, objective_tag_id)
    select v_session_id, tag.id
    from public.training_objective_tags tag
    where tag.organization_id = v_org_id
      and tag.slug in (
        case when v_record.group_name = 'Blu' then 'possesso-palla' else 'transizione' end,
        case when v_record.session_date in (date '2026-09-11', date '2026-09-23') then 'finalizzazione' else 'passaggio-ricezione' end
      )
    on conflict (training_session_id, objective_tag_id) do nothing;
  end loop;

  for v_record in select * from (values
    ('Blu', date '2026-09-13', 'ASD Aurora', 'home', 3::smallint, 2::smallint),
    ('Rosso', date '2026-09-15', 'Sporting Dora', 'away', 2::smallint, 2::smallint),
    ('Blu', date '2026-09-20', 'Juventus Collina', 'away', 1::smallint, 3::smallint),
    ('Rosso', date '2026-09-22', 'Oratorio San Carlo', 'home', 4::smallint, 1::smallint)
  ) as data(group_name, match_date, opponent, home_away, our_score, opponent_score) loop
    v_group_id := case when v_record.group_name = 'Blu' then v_blu_id else v_rosso_id end;
    insert into public.matches(organization_id, group_id, match_date, start_time, opponent, home_away, location, competition, status, our_score, opponent_score, coach_notes, created_by, match_format, period_count, period_duration_minutes, initial_formation)
    select v_org_id, v_group_id, v_record.match_date, time '10:30', v_record.opponent, v_record.home_away, case when v_record.home_away = 'home' then 'Centro Sportivo Demo' else 'Campo ospite' end, 'Torneo autunnale U10', 'completed', v_record.our_score, v_record.opponent_score, 'Partita dimostrativa con dati sintetici.', v_admin_id, 'seven_a_side', 4, 15, '3-2-1'
    where not exists (select 1 from public.matches where organization_id = v_org_id and group_id = v_group_id and match_date = v_record.match_date and opponent = v_record.opponent);
    select count(*), (array_agg(id order by id))[1] into v_count, v_match_id from public.matches where organization_id = v_org_id and group_id = v_group_id and match_date = v_record.match_date and opponent = v_record.opponent;
    if v_count <> 1 then raise exception 'Expected exactly one demo match vs %, found %', v_record.opponent, v_count; end if;

    insert into public.match_callups(match_id, organization_id, player_id, source, status, note, created_by)
    select v_match_id, v_org_id, roster.player_id, 'roster', case when roster.ordinal <= 7 then 'confirmed' else 'called' end, '', v_admin_id
    from (
      select membership.player_id, row_number() over(order by player.last_name, player.first_name) as ordinal
      from public.group_player_assignments assignment join public.team_player_memberships membership on membership.id = assignment.team_player_membership_id join public.players player on player.id = membership.player_id
      where assignment.organization_id = v_org_id and membership.organization_id = v_org_id and assignment.group_id = v_group_id and assignment.status = 'active' and membership.status = 'active'
      order by player.last_name, player.first_name limit 10
    ) roster
    on conflict (match_id, player_id) do nothing;
    select count(*) into v_count from public.match_callups where match_id = v_match_id;
    if v_count <> 10 then raise exception 'Expected exactly 10 demo call-ups vs %, found %', v_record.opponent, v_count; end if;

    v_position := 0;
    for v_player_id in
      select c.player_id from public.match_callups c join public.players p on p.id = c.player_id where c.match_id = v_match_id and c.status = 'confirmed' order by p.last_name, p.first_name limit 7
    loop
      v_position := v_position + 1;
      v_slot := (array['goalkeeper','defender-left','defender-center','defender-right','midfielder-left','midfielder-right','forward'])[v_position];
      v_x := (array[50,20,50,80,33,67,50])[v_position];
      v_y := (array[88,68,68,68,42,42,18])[v_position];
      insert into public.match_initial_lineup_entries(match_id, player_id, slot_id, position_x, position_y)
      values (v_match_id, v_player_id, v_slot, v_x, v_y)
      on conflict do nothing;
    end loop;
    select count(*) into v_count from public.match_initial_lineup_entries where match_id = v_match_id;
    if v_count <> 7 then raise exception 'Expected exactly seven lineup entries vs %, found %', v_record.opponent, v_count; end if;

    -- Completed demo matches receive a complete, synthetic Live history so the
    -- Match Live report, period score and FIGC score agree with matches.our_score.
    if not exists (select 1 from public.match_live_states where match_id = v_match_id) then
      if exists (select 1 from public.match_live_events where match_id = v_match_id) then
        raise exception 'Refusing to complete a partial Live history for demo match vs %', v_record.opponent;
      end if;
      insert into public.match_live_states(match_id, phase, current_period, elapsed_seconds, running_since, started_at, completed_at)
      values (v_match_id, 'completed', 4, 900, null, v_record.match_date + time '10:30', v_record.match_date + time '11:30');
      insert into public.match_live_active_players(match_id, player_id, slot_id)
      select match_id, player_id, slot_id from public.match_initial_lineup_entries where match_id = v_match_id;
      insert into public.match_player_stints(match_id, player_id, period_number, entered_elapsed_seconds, exited_elapsed_seconds)
      select v_match_id, line.player_id, period.number, 0, 900
      from public.match_initial_lineup_entries line cross join generate_series(1, 4) as period(number)
      where line.match_id = v_match_id;
      insert into public.match_live_events(match_id, request_id, event_type, period_number, elapsed_seconds, metadata, created_by)
      select v_match_id, gen_random_uuid(), event_type, period_number, elapsed_seconds, jsonb_build_object('operation', 'demo_seed'), v_admin_id
      from (
        select period.number as period_number, 'period_started'::text as event_type, 0 as elapsed_seconds from generate_series(1, 4) as period(number)
        union all
        select period.number, 'period_completed'::text, 900 from generate_series(1, 4) as period(number)
      ) periods;
      for v_goal_index in 1..v_record.our_score loop
        select player_id into v_scorer_id from public.match_callups where match_id = v_match_id and status = 'confirmed' order by player_id limit 1 offset ((v_goal_index - 1) % 7);
        insert into public.match_live_events(match_id, request_id, event_type, period_number, elapsed_seconds, scoring_team, scorer_player_id, metadata, created_by)
        values (v_match_id, gen_random_uuid(), 'goal', ((v_goal_index - 1) % 4) + 1, 180 + ((v_goal_index - 1) % 3) * 180, 'ours', v_scorer_id, jsonb_build_object('operation', 'demo_seed'), v_admin_id);
      end loop;
      for v_goal_index in 1..v_record.opponent_score loop
        insert into public.match_live_events(match_id, request_id, event_type, period_number, elapsed_seconds, scoring_team, opponent_jersey_number, metadata, created_by)
        values (v_match_id, gen_random_uuid(), 'goal', ((v_goal_index - 1) % 4) + 1, 300 + ((v_goal_index - 1) % 3) * 180, 'opponent', v_goal_index + 4, jsonb_build_object('operation', 'demo_seed'), v_admin_id);
      end loop;
      insert into public.match_live_events(match_id, request_id, event_type, period_number, elapsed_seconds, metadata, created_by)
      values (v_match_id, gen_random_uuid(), 'match_completed', 4, 900, jsonb_build_object('operation', 'demo_seed'), v_admin_id);
    end if;
    if not exists (select 1 from public.match_live_states where match_id = v_match_id and phase = 'completed' and current_period = 4) then
      raise exception 'Demo match vs % does not have a completed Live state', v_record.opponent;
    end if;
    select count(*) filter (where scoring_team = 'ours'), count(*) filter (where scoring_team = 'opponent')
      into v_our_goals, v_opponent_goals
    from public.match_live_events where match_id = v_match_id and event_type = 'goal' and voided_at is null;
    if v_our_goals <> v_record.our_score or v_opponent_goals <> v_record.opponent_score then
      raise exception 'Live score does not match the stored result for demo match vs %', v_record.opponent;
    end if;
  end loop;
end;
$$;

commit;

-- Post-seed verification (read-only). Run these queries after commit in the
-- same SQL editor; every result is scoped to the explicit demo slug.
select o.id, o.name, o.slug, o.description
from public.organizations o
where o.slug = 'torino-nord-academy-demo';

select g.name as group_name, count(distinct membership.player_id) as players
from public.groups g
join public.group_player_assignments assignment on assignment.group_id = g.id and assignment.status = 'active'
join public.team_player_memberships membership on membership.id = assignment.team_player_membership_id and membership.status = 'active'
join public.organizations o on o.id = g.organization_id
where o.slug = 'torino-nord-academy-demo'
group by g.name
order by g.name;

select
  (select count(*) from public.players p join public.organizations o on o.id = p.organization_id where o.slug = 'torino-nord-academy-demo') as players_expected_24,
  (select count(*) from public.exercise_library_items e join public.organizations o on o.id = e.organization_id where o.slug = 'torino-nord-academy-demo' and e.source_collection = 'torino-nord-demo-v1') as exercises_expected_6,
  (select count(*) from public.training_sessions s join public.organizations o on o.id = s.organization_id where o.slug = 'torino-nord-academy-demo') as sessions_expected_6,
  (select count(*) from public.training_session_attendance a join public.organizations o on o.id = a.organization_id where o.slug = 'torino-nord-academy-demo') as attendance_marks,
  (select count(*) from public.matches m join public.organizations o on o.id = m.organization_id where o.slug = 'torino-nord-academy-demo') as matches_expected_4,
  (select count(*) from public.match_callups c join public.matches m on m.id = c.match_id join public.organizations o on o.id = m.organization_id where o.slug = 'torino-nord-academy-demo') as callups,
  (select count(*) from public.match_initial_lineup_entries line join public.matches m on m.id = line.match_id join public.organizations o on o.id = m.organization_id where o.slug = 'torino-nord-academy-demo') as lineup_entries;

select m.opponent, m.our_score, m.opponent_score,
  count(event.id) filter (where event.event_type = 'goal' and event.scoring_team = 'ours' and event.voided_at is null) as live_ours,
  count(event.id) filter (where event.event_type = 'goal' and event.scoring_team = 'opponent' and event.voided_at is null) as live_opponents
from public.matches m
join public.organizations o on o.id = m.organization_id
left join public.match_live_events event on event.match_id = m.id
where o.slug = 'torino-nord-academy-demo'
group by m.id, m.opponent, m.our_score, m.opponent_score
order by m.match_date;

-- Additional read-only verification: active demo coach memberships.
select g.name as demo_group, gm.role, gm.active, count(*) as staff_memberships
from public.group_memberships gm
join public.groups g on g.id = gm.group_id and g.organization_id = gm.organization_id
join public.organizations o on o.id = gm.organization_id
where o.slug = 'torino-nord-academy-demo'
group by g.name, gm.role, gm.active
order by g.name, gm.role;

-- FIGC per-period points: victory 1-0, draw 1-1, defeat 0-1.
-- These points are deliberately distinct from total goals.
with per_period as (
  select m.id as match_id, m.opponent, gs.period_number,
    count(e.id) filter (where e.scoring_team = 'ours') as our_goals,
    count(e.id) filter (where e.scoring_team = 'opponent') as opponent_goals
  from public.matches m
  join public.organizations o on o.id = m.organization_id
  cross join lateral generate_series(1, m.period_count) as gs(period_number)
  left join public.match_live_events e on e.match_id = m.id
    and e.period_number = gs.period_number and e.event_type = 'goal'
    and e.voided_at is null
  where o.slug = 'torino-nord-academy-demo'
  group by m.id, m.opponent, gs.period_number
)
select opponent, sum(our_goals) as our_total_goals,
       sum(opponent_goals) as opponent_total_goals,
       sum(case when our_goals >= opponent_goals then 1 else 0 end) as figc_ours,
       sum(case when opponent_goals >= our_goals then 1 else 0 end) as figc_opponent
from per_period
group by match_id, opponent
order by opponent;
