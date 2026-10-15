-- GrowPitch: persistent live-match engine and private staff report.
-- Apply manually after migrations 015, 016 and 022.
begin;

-- New matches default to the approved seven-a-side shape. Existing rows keep
-- their saved value, including the former 2-3-1 default.
alter table public.matches alter column initial_formation set default '3-2-1';

create table public.match_live_states (
  match_id uuid primary key references public.matches(id) on delete cascade,
  phase text not null default 'ready' check (phase in ('ready','running','paused','interval','completed')),
  current_period smallint not null default 0 check (current_period between 0 and 12),
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  running_since timestamptz,
  version integer not null default 1 check (version > 0),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((phase = 'running') = (running_since is not null))
);

create table public.match_live_active_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  slot_id text not null,
  primary key (match_id, player_id),
  unique (match_id, slot_id)
);

create table public.match_player_stints (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  period_number smallint not null check (period_number between 1 and 12),
  entered_elapsed_seconds integer not null check (entered_elapsed_seconds >= 0),
  exited_elapsed_seconds integer check (exited_elapsed_seconds is null or exited_elapsed_seconds >= entered_elapsed_seconds),
  created_at timestamptz not null default now()
);
create unique index match_player_open_stint_idx on public.match_player_stints(match_id, player_id, period_number) where exited_elapsed_seconds is null;
create index match_player_stints_match_idx on public.match_player_stints(match_id, period_number);

create table public.match_live_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  request_id uuid not null,
  event_type text not null check (event_type in ('period_started','paused','resumed','period_completed','substitution','goal','goal_voided','match_completed')),
  period_number smallint check (period_number between 1 and 12),
  elapsed_seconds integer check (elapsed_seconds is null or elapsed_seconds >= 0),
  scoring_team text check (scoring_team is null or scoring_team in ('ours','opponent')),
  scorer_player_id uuid references public.players(id) on delete restrict,
  opponent_jersey_number smallint check (opponent_jersey_number is null or opponent_jersey_number between 0 and 99),
  player_out_id uuid references public.players(id) on delete restrict,
  player_in_id uuid references public.players(id) on delete restrict,
  corrects_event_id uuid references public.match_live_events(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (match_id, request_id)
);
create index match_live_events_match_idx on public.match_live_events(match_id, created_at);
create index match_live_events_period_idx on public.match_live_events(match_id, period_number, event_type) where voided_at is null;

-- clock_timestamp() changes within a statement; this function must never be
-- marked STABLE or an elapsed value could be reused after a pause/resume.
create or replace function private.match_live_elapsed(p_state public.match_live_states)
returns integer language sql volatile security definer set search_path = '' as $$
  select p_state.elapsed_seconds + case when p_state.phase = 'running'
    then greatest(0, floor(extract(epoch from clock_timestamp() - p_state.running_since))::integer) else 0 end;
$$;
alter function private.match_live_elapsed(public.match_live_states) owner to postgres;
revoke all on function private.match_live_elapsed(public.match_live_states) from public, anon, authenticated;

create or replace function private.match_live_request_replayed(
  p_match_id uuid, p_request_id uuid, p_operation text, p_fingerprint jsonb default '{}'::jsonb
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare recorded public.match_live_events%rowtype;
begin
  if p_request_id is null then raise exception 'A request ID is required' using errcode = '22023'; end if;
  select * into recorded from public.match_live_events where match_id = p_match_id and request_id = p_request_id;
  if not found then return false; end if;
  if recorded.metadata->>'operation' <> p_operation
     or coalesce(recorded.metadata->'fingerprint','{}'::jsonb) is distinct from coalesce(p_fingerprint,'{}'::jsonb) then
    raise exception 'Request ID was already used for a different live operation' using errcode = '23505';
  end if;
  return true;
end;
$$;
alter function private.match_live_request_replayed(uuid,uuid,text,jsonb) owner to postgres;
revoke all on function private.match_live_request_replayed(uuid,uuid,text,jsonb) from public, anon, authenticated;

create or replace function private.match_live_authorize(p_match_id uuid, p_lock boolean default true)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_lock then select * into target from public.matches where id = p_match_id for update;
  else select * into target from public.matches where id = p_match_id;
  end if;
  if not found or not private.has_match_permission(target.group_id, 'matches.edit') then
    raise exception 'Permission denied or match not found' using errcode = '42501';
  end if;
  return target;
end;
$$;
alter function private.match_live_authorize(uuid, boolean) owner to postgres;
revoke all on function private.match_live_authorize(uuid, boolean) from public, anon, authenticated;

create or replace function private.match_live_sync_score(p_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ours smallint; opponents smallint;
begin
  select count(*) filter (where scoring_team = 'ours')::smallint,
         count(*) filter (where scoring_team = 'opponent')::smallint
  into ours, opponents
  from public.match_live_events where match_id = p_match_id and event_type = 'goal' and voided_at is null;
  update public.matches set our_score = coalesce(ours, 0), opponent_score = coalesce(opponents, 0), updated_at = now() where id = p_match_id;
end;
$$;
alter function private.match_live_sync_score(uuid) owner to postgres;
revoke all on function private.match_live_sync_score(uuid) from public, anon, authenticated;

-- Read access is still scoped through the owning match. Clients do not get
-- INSERT/UPDATE/DELETE grants: live mutations go through locked RPCs only.
alter table public.match_live_states enable row level security;
alter table public.match_live_active_players enable row level security;
alter table public.match_player_stints enable row level security;
alter table public.match_live_events enable row level security;
revoke all on public.match_live_states, public.match_live_active_players,
  public.match_player_stints, public.match_live_events from public, anon, authenticated;
grant select on public.match_live_states, public.match_live_active_players,
  public.match_player_stints, public.match_live_events to authenticated;
create policy match_live_state_read on public.match_live_states for select to authenticated using (exists (select 1 from public.matches m where m.id = match_id and private.has_match_permission(m.group_id, 'matches.view')));
create policy match_live_active_read on public.match_live_active_players for select to authenticated using (exists (select 1 from public.matches m where m.id = match_id and private.has_match_permission(m.group_id, 'matches.view')));
create policy match_live_stint_read on public.match_player_stints for select to authenticated using (exists (select 1 from public.matches m where m.id = match_id and private.has_match_permission(m.group_id, 'matches.view')));
create policy match_live_event_read on public.match_live_events for select to authenticated using (exists (select 1 from public.matches m where m.id = match_id and private.has_match_permission(m.group_id, 'matches.view')));

-- Once the live engine has started, its initial snapshot and match shape are
-- historical facts. These triggers cover direct table writes, the normal
-- editor and both save_match_initial_lineup overloads.
create or replace function private.prevent_live_initial_lineup_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_match uuid;
begin
  if tg_op = 'DELETE' then
    target_match := old.match_id;
  else
    target_match := new.match_id;
  end if;
  if exists (select 1 from public.match_live_states where match_id = target_match) then
    raise exception 'Initial lineup is immutable after the match has started' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
alter function private.prevent_live_initial_lineup_change() owner to postgres;
revoke all on function private.prevent_live_initial_lineup_change() from public, anon, authenticated;
create trigger prevent_live_initial_lineup_change before insert or update or delete on public.match_initial_lineup_entries
for each row execute function private.prevent_live_initial_lineup_change();

create or replace function private.prevent_live_match_configuration_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.match_format, new.period_count, new.period_duration_minutes, new.initial_formation)
       is distinct from (old.match_format, old.period_count, old.period_duration_minutes, old.initial_formation)
     and exists (select 1 from public.match_live_states where match_id = old.id) then
    raise exception 'Match format, periods and formation are immutable after the match has started' using errcode = '42501';
  end if;
  return new;
end;
$$;
alter function private.prevent_live_match_configuration_change() owner to postgres;
revoke all on function private.prevent_live_match_configuration_change() from public, anon, authenticated;
create trigger prevent_live_match_configuration_change before update on public.matches
for each row execute function private.prevent_live_match_configuration_change();

create or replace function public.start_match_live(p_match_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; lineup_count integer;
begin
  target := private.match_live_authorize(p_match_id, true);
  if private.match_live_request_replayed(target.id, p_request_id, 'start') then return; end if;
  select count(*) into lineup_count from public.match_initial_lineup_entries l join public.match_callups c on c.match_id = l.match_id and c.player_id = l.player_id where l.match_id = target.id and c.status in ('called','confirmed');
  if lineup_count <> 7 then raise exception 'A live match requires exactly seven called or confirmed lineup players' using errcode = '22023'; end if;
  if exists (select 1 from public.match_live_states where match_id = target.id) then raise exception 'Live match already started' using errcode = '22023'; end if;
  insert into public.match_live_states(match_id,phase,current_period,elapsed_seconds,running_since,started_at) values (target.id,'running',1,0,now(),now());
  insert into public.match_live_active_players(match_id,player_id,slot_id) select match_id,player_id,slot_id from public.match_initial_lineup_entries where match_id = target.id;
  insert into public.match_player_stints(match_id,player_id,period_number,entered_elapsed_seconds) select target.id,player_id,1,0 from public.match_live_active_players where match_id = target.id;
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,metadata) values (target.id,p_request_id,'period_started',1,0,jsonb_build_object('operation','start'));
  update public.matches set status = 'live', our_score = 0, opponent_score = 0, updated_at = now() where id = target.id;
end;
$$;

create or replace function public.pause_match_live(p_match_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype; elapsed integer;
begin
  target := private.match_live_authorize(p_match_id, true);
  if private.match_live_request_replayed(target.id, p_request_id, 'pause') then return; end if;
  select * into state from public.match_live_states where match_id = target.id for update;
  if not found or state.phase <> 'running' then raise exception 'Only a running match can be paused' using errcode = '22023'; end if;
  elapsed := private.match_live_elapsed(state);
  update public.match_live_states set phase='paused', elapsed_seconds=elapsed, running_since=null, version=version+1, updated_at=now() where match_id=target.id;
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,metadata) values(target.id,p_request_id,'paused',state.current_period,elapsed,jsonb_build_object('operation','pause'));
end;
$$;

create or replace function public.resume_match_live(p_match_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype;
begin
  target := private.match_live_authorize(p_match_id, true);
  if private.match_live_request_replayed(target.id, p_request_id, 'resume') then return; end if;
  select * into state from public.match_live_states where match_id = target.id for update;
  if not found or state.phase <> 'paused' then raise exception 'Only a paused match can be resumed' using errcode = '22023'; end if;
  update public.match_live_states set phase='running', running_since=now(), version=version+1, updated_at=now() where match_id=target.id;
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,metadata) values(target.id,p_request_id,'resumed',state.current_period,state.elapsed_seconds,jsonb_build_object('operation','resume'));
end;
$$;

create or replace function public.finish_match_period(p_match_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype; elapsed integer;
begin
  target := private.match_live_authorize(p_match_id, true);
  if private.match_live_request_replayed(target.id, p_request_id, 'finish_period') then return; end if;
  select * into state from public.match_live_states where match_id = target.id for update;
  if not found or state.phase not in ('running','paused') then raise exception 'Only a running or paused period can be finished' using errcode = '22023'; end if;
  elapsed := private.match_live_elapsed(state);
  update public.match_player_stints set exited_elapsed_seconds=elapsed where match_id=target.id and period_number=state.current_period and exited_elapsed_seconds is null;
  update public.match_live_states set phase='interval', elapsed_seconds=elapsed, running_since=null, version=version+1, updated_at=now() where match_id=target.id;
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,metadata) values(target.id,p_request_id,'period_completed',state.current_period,elapsed,jsonb_build_object('operation','finish_period'));
end;
$$;

create or replace function public.start_next_match_period(p_match_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype; next_period smallint;
begin
  target := private.match_live_authorize(p_match_id, true);
  if private.match_live_request_replayed(target.id, p_request_id, 'start_next_period') then return; end if;
  select * into state from public.match_live_states where match_id = target.id for update;
  if not found or state.phase <> 'interval' or state.current_period >= target.period_count then raise exception 'No next period is available' using errcode = '22023'; end if;
  next_period := state.current_period + 1;
  update public.match_live_states set phase='running', current_period=next_period, elapsed_seconds=0, running_since=now(), version=version+1, updated_at=now() where match_id=target.id;
  insert into public.match_player_stints(match_id,player_id,period_number,entered_elapsed_seconds) select target.id,player_id,next_period,0 from public.match_live_active_players where match_id=target.id;
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,metadata) values(target.id,p_request_id,'period_started',next_period,0,jsonb_build_object('operation','start_next_period'));
end;
$$;

create or replace function public.substitute_match_live_player(p_match_id uuid, p_player_out_id uuid, p_player_in_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype; elapsed integer; event_elapsed integer; previous_slot text; target_period smallint;
begin
  target := private.match_live_authorize(p_match_id, true);
  if p_player_out_id = p_player_in_id then raise exception 'A substitution requires two different players' using errcode='22023'; end if;
  if private.match_live_request_replayed(target.id, p_request_id, 'substitution', jsonb_build_object('playerOutId',p_player_out_id,'playerInId',p_player_in_id)) then return; end if;
  select * into state from public.match_live_states where match_id=target.id for update;
  if not found or state.phase not in ('running','paused','interval') then raise exception 'A substitution is not allowed in the current match state' using errcode='22023'; end if;
  if state.phase = 'interval' and state.current_period >= target.period_count then raise exception 'The final interval cannot receive substitutions' using errcode='22023'; end if;
  select slot_id into previous_slot from public.match_live_active_players where match_id=target.id and player_id=p_player_out_id for update;
  if previous_slot is null then raise exception 'Outgoing player is not on the field' using errcode='23503'; end if;
  if exists(select 1 from public.match_live_active_players where match_id=target.id and player_id=p_player_in_id) then raise exception 'Incoming player is already on the field' using errcode='23505'; end if;
  if not exists(select 1 from public.match_callups where match_id=target.id and player_id=p_player_in_id and status in ('called','confirmed')) then raise exception 'Incoming player must be called or confirmed' using errcode='23503'; end if;
  elapsed := private.match_live_elapsed(state);
  if state.phase <> 'interval' then
    update public.match_player_stints set exited_elapsed_seconds=elapsed where match_id=target.id and player_id=p_player_out_id and period_number=state.current_period and exited_elapsed_seconds is null;
    insert into public.match_player_stints(match_id,player_id,period_number,entered_elapsed_seconds) values(target.id,p_player_in_id,state.current_period,elapsed);
    target_period := state.current_period;
    event_elapsed := elapsed;
  else
    -- Interval substitutions prepare the next period: no elapsed time from
    -- the completed period leaks into their event or the next stints.
    target_period := state.current_period + 1;
    event_elapsed := 0;
  end if;
  delete from public.match_live_active_players where match_id=target.id and player_id=p_player_out_id;
  insert into public.match_live_active_players(match_id,player_id,slot_id) values(target.id,p_player_in_id,previous_slot);
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,player_out_id,player_in_id,metadata) values(target.id,p_request_id,'substitution',target_period,event_elapsed,p_player_out_id,p_player_in_id,jsonb_build_object('operation','substitution','fingerprint',jsonb_build_object('playerOutId',p_player_out_id,'playerInId',p_player_in_id)));
end;
$$;

create or replace function public.record_match_live_goal(p_match_id uuid, p_scoring_team text, p_scorer_player_id uuid, p_opponent_jersey_number smallint, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype; elapsed integer;
begin
  target := private.match_live_authorize(p_match_id, true);
  if p_scoring_team not in ('ours','opponent') then raise exception 'Invalid scoring team' using errcode='22023'; end if;
  if p_scoring_team = 'opponent' and p_scorer_player_id is not null then raise exception 'Opponent goals cannot use a club player scorer' using errcode='22023'; end if;
  if p_scoring_team = 'ours' and p_opponent_jersey_number is not null then raise exception 'Our goals cannot use an opponent jersey number' using errcode='22023'; end if;
  if p_scoring_team = 'ours' and p_scorer_player_id is not null and not exists(select 1 from public.match_callups where match_id=target.id and player_id=p_scorer_player_id and status in ('called','confirmed')) then raise exception 'Scorer must be called or confirmed for this match' using errcode='23503'; end if;
  if private.match_live_request_replayed(target.id, p_request_id, 'goal', jsonb_build_object('team',p_scoring_team,'scorerPlayerId',p_scorer_player_id,'opponentJerseyNumber',p_opponent_jersey_number)) then return; end if;
  select * into state from public.match_live_states where match_id=target.id for update;
  if not found or state.phase not in ('running','paused') then raise exception 'Goals can only be recorded during a running or paused period' using errcode='22023'; end if;
  elapsed := private.match_live_elapsed(state);
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,scoring_team,scorer_player_id,opponent_jersey_number,metadata) values(target.id,p_request_id,'goal',state.current_period,elapsed,p_scoring_team,p_scorer_player_id,p_opponent_jersey_number,jsonb_build_object('operation','goal','fingerprint',jsonb_build_object('team',p_scoring_team,'scorerPlayerId',p_scorer_player_id,'opponentJerseyNumber',p_opponent_jersey_number)));
  perform private.match_live_sync_score(target.id);
end;
$$;

create or replace function public.void_match_live_goal(p_match_id uuid, p_goal_event_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; goal public.match_live_events%rowtype; state public.match_live_states%rowtype;
begin
  target := private.match_live_authorize(p_match_id, true);
  if private.match_live_request_replayed(target.id, p_request_id, 'void_goal', jsonb_build_object('goalEventId',p_goal_event_id)) then return; end if;
  select * into goal from public.match_live_events where id=p_goal_event_id and match_id=target.id for update;
  if not found or goal.event_type <> 'goal' or goal.voided_at is not null then raise exception 'Goal event cannot be voided' using errcode='22023'; end if;
  select * into state from public.match_live_states where match_id=target.id for update;
  update public.match_live_events set voided_at=now(), voided_by=auth.uid() where id=goal.id;
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,corrects_event_id,metadata) values(target.id,p_request_id,'goal_voided',goal.period_number,coalesce(state.elapsed_seconds,goal.elapsed_seconds),goal.id,jsonb_build_object('operation','void_goal','fingerprint',jsonb_build_object('goalEventId',p_goal_event_id)));
  perform private.match_live_sync_score(target.id);
end;
$$;

create or replace function public.complete_match_live(p_match_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype;
begin
  target := private.match_live_authorize(p_match_id, true);
  if private.match_live_request_replayed(target.id, p_request_id, 'complete') then return; end if;
  select * into state from public.match_live_states where match_id=target.id for update;
  if not found or state.phase <> 'interval' or state.current_period <> target.period_count then raise exception 'Complete all configured periods before completing the match' using errcode='22023'; end if;
  update public.match_live_states set phase='completed', completed_at=now(), version=version+1, updated_at=now() where match_id=target.id;
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,metadata) values(target.id,p_request_id,'match_completed',state.current_period,state.elapsed_seconds,jsonb_build_object('operation','complete'));
  perform private.match_live_sync_score(target.id);
  update public.matches set status='completed', updated_at=now() where id=target.id;
end;
$$;

create or replace function public.get_match_live_snapshot(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into target from public.matches where id=p_match_id;
  if not found or not private.has_match_permission(target.group_id,'matches.view') then raise exception 'Permission denied or match not found' using errcode='42501'; end if;
  select * into state from public.match_live_states where match_id=target.id;
  return jsonb_build_object(
    'matchId', target.id, 'phase', coalesce(state.phase,'ready'), 'currentPeriod', coalesce(state.current_period,0),
    'elapsedSeconds', case when state.match_id is null then 0 else private.match_live_elapsed(state) end,
    'version', coalesce(state.version,0), 'activePlayers', coalesce((select jsonb_agg(jsonb_build_object('playerId',a.player_id,'slotId',a.slot_id) order by a.slot_id) from public.match_live_active_players a where a.match_id=target.id),'[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'period',e.period_number,'elapsedSeconds',e.elapsed_seconds,'scoringTeam',e.scoring_team,'scorerPlayerId',e.scorer_player_id,'opponentJerseyNumber',e.opponent_jersey_number,'playerOutId',e.player_out_id,'playerInId',e.player_in_id,'voidedAt',e.voided_at,'createdAt',e.created_at) order by e.created_at) from public.match_live_events e where e.match_id=target.id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_match_live_report(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into target from public.matches where id=p_match_id;
  if not found or not private.has_match_permission(target.group_id,'matches.view') then raise exception 'Permission denied or match not found' using errcode='42501'; end if;
  return jsonb_build_object(
    'match', jsonb_build_object('id',target.id,'opponent',target.opponent,'matchDate',target.match_date,'startTime',target.start_time,'location',target.location,'competition',target.competition,'homeAway',target.home_away,'periodCount',target.period_count,'periodDurationMinutes',target.period_duration_minutes,'coachNotes',target.coach_notes),
    'globalScore', jsonb_build_object('ours',coalesce((select count(*) from public.match_live_events e where e.match_id=target.id and e.event_type='goal' and e.scoring_team='ours' and e.voided_at is null),0),'opponent',coalesce((select count(*) from public.match_live_events e where e.match_id=target.id and e.event_type='goal' and e.scoring_team='opponent' and e.voided_at is null),0)),
    'periods', coalesce((select jsonb_agg(jsonb_build_object('period',p.period,'ours',p.ours,'opponent',p.opponent,'completed',p.completed,'figcOurs',case when p.completed then case when p.ours >= p.opponent then 1 else 0 end else 0 end,'figcOpponent',case when p.completed then case when p.opponent >= p.ours then 1 else 0 end else 0 end) order by p.period) from (select gs as period, count(e.id) filter(where e.scoring_team='ours')::int as ours, count(e.id) filter(where e.scoring_team='opponent')::int as opponent, exists(select 1 from public.match_live_events completed where completed.match_id=target.id and completed.event_type='period_completed' and completed.period_number=gs and completed.voided_at is null) as completed from generate_series(1,target.period_count) gs left join public.match_live_events e on e.match_id=target.id and e.event_type='goal' and e.period_number=gs and e.voided_at is null group by gs) p),'[]'::jsonb),
    'figcScore', jsonb_build_object('ours',coalesce((select sum(case when p.ours >= p.opponent then 1 else 0 end) from (select gs, count(e.id) filter(where e.scoring_team='ours') as ours, count(e.id) filter(where e.scoring_team='opponent') as opponent from generate_series(1,target.period_count) gs join public.match_live_events completed on completed.match_id=target.id and completed.event_type='period_completed' and completed.period_number=gs and completed.voided_at is null left join public.match_live_events e on e.match_id=target.id and e.event_type='goal' and e.period_number=gs and e.voided_at is null group by gs) p),0),'opponent',coalesce((select sum(case when p.opponent >= p.ours then 1 else 0 end) from (select gs, count(e.id) filter(where e.scoring_team='ours') as ours, count(e.id) filter(where e.scoring_team='opponent') as opponent from generate_series(1,target.period_count) gs join public.match_live_events completed on completed.match_id=target.id and completed.event_type='period_completed' and completed.period_number=gs and completed.voided_at is null left join public.match_live_events e on e.match_id=target.id and e.event_type='goal' and e.period_number=gs and e.voided_at is null group by gs) p),0)),
    'goals', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'period',e.period_number,'elapsedSeconds',e.elapsed_seconds,'team',e.scoring_team,'scorerPlayerId',e.scorer_player_id,'scorerName',nullif(concat_ws(' ',pl.first_name,pl.last_name),''),'opponentJerseyNumber',e.opponent_jersey_number) order by e.created_at) from public.match_live_events e left join public.players pl on pl.id=e.scorer_player_id where e.match_id=target.id and e.event_type='goal' and e.voided_at is null),'[]'::jsonb),
    'substitutions', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'period',e.period_number,'elapsedSeconds',e.elapsed_seconds,'playerOutId',e.player_out_id,'playerInId',e.player_in_id) order by e.created_at) from public.match_live_events e where e.match_id=target.id and e.event_type='substitution' and e.voided_at is null),'[]'::jsonb)
  );
end;
$$;

-- When a coach switches module from the Formation tab, the configuration and
-- its replacement lineup must commit or roll back together. The existing
-- three-argument function remains available for ordinary lineup saves.
create or replace function public.save_match_initial_lineup(
  p_match_id uuid,
  p_entries jsonb,
  p_expected_updated_at timestamptz,
  p_initial_formation text
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype; configuration_updated_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_initial_formation not in ('2-3-1','3-2-1') then raise exception 'Invalid initial formation' using errcode = '22023'; end if;
  select * into target from public.matches where id = p_match_id for update;
  if not found or not private.has_match_permission(target.group_id, 'matches.edit') then raise exception 'Permission denied or match not found' using errcode = '42501'; end if;
  if p_expected_updated_at is null or target.updated_at is distinct from p_expected_updated_at then raise exception 'Match changed. Reload before saving.' using errcode = '40001'; end if;
  update public.matches set initial_formation = p_initial_formation, updated_at = clock_timestamp()
  where id = target.id returning updated_at into configuration_updated_at;
  return public.save_match_initial_lineup(target.id, p_entries, configuration_updated_at);
end;
$$;

alter function public.start_match_live(uuid,uuid) owner to postgres;
alter function public.pause_match_live(uuid,uuid) owner to postgres;
alter function public.resume_match_live(uuid,uuid) owner to postgres;
alter function public.finish_match_period(uuid,uuid) owner to postgres;
alter function public.start_next_match_period(uuid,uuid) owner to postgres;
alter function public.substitute_match_live_player(uuid,uuid,uuid,uuid) owner to postgres;
alter function public.record_match_live_goal(uuid,text,uuid,smallint,uuid) owner to postgres;
alter function public.void_match_live_goal(uuid,uuid,uuid) owner to postgres;
alter function public.complete_match_live(uuid,uuid) owner to postgres;
alter function public.get_match_live_snapshot(uuid) owner to postgres;
alter function public.get_match_live_report(uuid) owner to postgres;
alter function public.save_match_initial_lineup(uuid,jsonb,timestamptz,text) owner to postgres;
revoke all on function public.start_match_live(uuid,uuid), public.pause_match_live(uuid,uuid), public.resume_match_live(uuid,uuid), public.finish_match_period(uuid,uuid), public.start_next_match_period(uuid,uuid), public.substitute_match_live_player(uuid,uuid,uuid,uuid), public.record_match_live_goal(uuid,text,uuid,smallint,uuid), public.void_match_live_goal(uuid,uuid,uuid), public.complete_match_live(uuid,uuid), public.get_match_live_snapshot(uuid), public.get_match_live_report(uuid) from public, anon, authenticated;
revoke all on function public.save_match_initial_lineup(uuid,jsonb,timestamptz,text) from public, anon, authenticated;
grant execute on function public.start_match_live(uuid,uuid), public.pause_match_live(uuid,uuid), public.resume_match_live(uuid,uuid), public.finish_match_period(uuid,uuid), public.start_next_match_period(uuid,uuid), public.substitute_match_live_player(uuid,uuid,uuid,uuid), public.record_match_live_goal(uuid,text,uuid,smallint,uuid), public.void_match_live_goal(uuid,uuid,uuid), public.complete_match_live(uuid,uuid), public.get_match_live_snapshot(uuid), public.get_match_live_report(uuid) to authenticated;
grant execute on function public.save_match_initial_lineup(uuid,jsonb,timestamptz,text) to authenticated;

commit;
