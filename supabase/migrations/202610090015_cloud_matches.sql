-- Coach Field - cloud matches and player call-ups
begin;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  group_id uuid not null,
  match_date date not null,
  start_time time,
  opponent text not null check (char_length(btrim(opponent)) between 1 and 160),
  home_away text not null check (home_away in ('home', 'away')),
  location text check (location is null or char_length(btrim(location)) between 1 and 240),
  competition text check (competition is null or char_length(btrim(competition)) between 1 and 160),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  our_score smallint check (our_score is null or our_score >= 0),
  opponent_score smallint check (opponent_score is null or opponent_score >= 0),
  coach_notes text not null default '' check (char_length(coach_notes) <= 10000),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (group_id, organization_id) references public.groups(id, organization_id) on delete restrict,
  unique (id, organization_id),
  constraint match_score_pair_check check ((our_score is null) = (opponent_score is null)),
  constraint completed_match_requires_score check (status <> 'completed' or our_score is not null),
  constraint cancelled_match_has_no_score check (status <> 'cancelled' or our_score is null)
);
create index matches_group_date_idx on public.matches(group_id, match_date, start_time);

-- A call-up is the durable record of who was invited.  source='guest' means a
-- same-organization player borrowed from another active WorkGroup; no stable
-- assignment is changed.  Keeping the row preserves the match history after
-- a later WorkGroup transfer.
create table public.match_callups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  source text not null default 'roster' check (source in ('roster', 'guest')),
  status text not null default 'called' check (status in ('called', 'confirmed', 'unavailable')),
  note text not null default '' check (char_length(note) <= 2000),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);
create index match_callups_match_idx on public.match_callups(match_id, status);
create index match_callups_player_idx on public.match_callups(player_id, created_at desc);

create or replace function private.has_match_permission(grp uuid, requested text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = grp and (
      private.is_admin(g.organization_id)
      or (g.active and exists (
        select 1 from public.group_memberships m
        where m.group_id = g.id and m.user_id = auth.uid() and m.active
          and (m.role = 'coach' or (
            m.role = 'collaborator' and coalesce((
              select p.enabled from public.collaborator_permissions p
              where p.membership_id = m.id and p.permission = requested
            ), requested = 'matches.view')
          ))
      ))
    )
  );
$$;
alter function private.has_match_permission(uuid, text) owner to postgres;
revoke all on function private.has_match_permission(uuid, text) from public, anon, authenticated;
grant execute on function private.has_match_permission(uuid, text) to authenticated;

create or replace function private.touch_cloud_match_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
alter function private.touch_cloud_match_updated_at() owner to postgres;
revoke all on function private.touch_cloud_match_updated_at() from public, anon, authenticated;
create trigger touch_matches_updated_at before update on public.matches for each row execute function private.touch_cloud_match_updated_at();
create trigger touch_match_callups_updated_at before update on public.match_callups for each row execute function private.touch_cloud_match_updated_at();

create or replace function private.validate_cloud_match_actor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and tg_op = 'INSERT' and new.created_by <> auth.uid() then
    raise exception 'Match creator must be the authenticated user' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.group_id <> old.group_id then
      raise exception 'A match cannot be moved to another WorkGroup' using errcode = '42501';
    end if;
    if new.created_by <> old.created_by then
      raise exception 'Match creator is immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
alter function private.validate_cloud_match_actor() owner to postgres;
revoke all on function private.validate_cloud_match_actor() from public, anon, authenticated;
create trigger validate_cloud_match_actor before insert or update on public.matches for each row execute function private.validate_cloud_match_actor();

-- Directly reject cross-organization data.  On creation, a player must be in
-- the stable roster or an active assignment of another WorkGroup in the same
-- organization.  Updating the status of an existing call-up intentionally
-- does not re-check current assignments: that row is the historical snapshot.
create or replace function private.validate_match_callup_participant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target public.matches%rowtype;
  player_org uuid;
  stable boolean;
begin
  if auth.uid() is not null and tg_op = 'INSERT' and new.created_by <> auth.uid() then
    raise exception 'Call-up creator must be the authenticated user' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.created_by <> old.created_by then
    raise exception 'Call-up creator is immutable' using errcode = '42501';
  end if;
  select * into target from public.matches where id = new.match_id;
  select organization_id into player_org from public.players where id = new.player_id and archived_at is null;
  if target.id is null or player_org is null or new.organization_id <> target.organization_id or player_org <> target.organization_id then
    raise exception 'Call-up player and match must belong to the same organization' using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' and old.match_id = new.match_id and old.player_id = new.player_id then
    return new;
  end if;
  select exists (
    select 1 from public.group_player_assignments a
    join public.team_player_memberships m on m.id = a.team_player_membership_id
    where a.group_id = target.group_id and a.status = 'active'
      and m.status = 'active' and m.player_id = new.player_id
  ) into stable;
  if stable then
    new.source := 'roster';
  elsif exists (
    select 1 from public.group_player_assignments a
    join public.team_player_memberships m on m.id = a.team_player_membership_id
    where a.organization_id = target.organization_id and a.status = 'active'
      and m.status = 'active' and m.player_id = new.player_id
  ) then
    new.source := 'guest';
  else
    raise exception 'Player is not an active WorkGroup player in this organization' using errcode = '23503';
  end if;
  return new;
end;
$$;
alter function private.validate_match_callup_participant() owner to postgres;
revoke all on function private.validate_match_callup_participant() from public, anon, authenticated;
create trigger validate_match_callup_participant before insert or update of match_id, organization_id, player_id on public.match_callups for each row execute function private.validate_match_callup_participant();

alter table public.matches enable row level security;
alter table public.match_callups enable row level security;
grant select, insert, update on public.matches to authenticated;
grant select, insert, update, delete on public.match_callups to authenticated;

create policy match_read on public.matches for select to authenticated
using (private.has_match_permission(group_id, 'matches.view'));
create policy match_create on public.matches for insert to authenticated
with check (private.has_match_permission(group_id, 'matches.create'));
create policy match_update on public.matches for update to authenticated
using (private.has_match_permission(group_id, 'matches.edit'))
with check (private.has_match_permission(group_id, 'matches.edit'));

create policy match_callup_read on public.match_callups for select to authenticated
using (exists (select 1 from public.matches m where m.id = match_id and private.has_match_permission(m.group_id, 'matches.view')));
create policy match_callup_write on public.match_callups for all to authenticated
using (exists (select 1 from public.matches m where m.id = match_id and private.has_match_permission(m.group_id, 'matches.edit')))
with check (exists (select 1 from public.matches m where m.id = match_id and private.has_match_permission(m.group_id, 'matches.edit')));

commit;
