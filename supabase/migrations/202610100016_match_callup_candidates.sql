-- Coach Field - secure cross-WorkGroup match call-up candidates
begin;

-- Preserve the WorkGroup from which a temporary call-up originated. Existing
-- historical rows predate this field and intentionally remain NULL.
alter table public.match_callups
  add column source_group_id uuid references public.groups(id) on delete restrict;
create index match_callups_source_group_idx on public.match_callups(source_group_id)
  where source_group_id is not null;

create or replace function private.validate_match_callup_participant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target public.matches%rowtype;
  player_org uuid;
  current_group uuid;
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

  -- A persisted row is the historical snapshot. Status changes must remain
  -- possible after a player later moves to another WorkGroup.
  if tg_op = 'UPDATE' and old.match_id = new.match_id and old.player_id = new.player_id then
    return new;
  end if;

  select assignment.group_id into current_group
  from public.group_player_assignments assignment
  join public.team_player_memberships membership on membership.id = assignment.team_player_membership_id
  where assignment.organization_id = target.organization_id
    and assignment.status = 'active'
    and membership.status = 'active'
    and membership.player_id = new.player_id
  order by (assignment.group_id = target.group_id) desc, assignment.created_at desc
  limit 1;
  if current_group is null then
    raise exception 'Player is not an active WorkGroup player in this organization' using errcode = '23503';
  end if;
  if current_group = target.group_id then
    new.source := 'roster';
  else
    new.source := 'guest';
  end if;
  new.source_group_id := current_group;
  return new;
end;
$$;
alter function private.validate_match_callup_participant() owner to postgres;
revoke all on function private.validate_match_callup_participant() from public, anon, authenticated;

-- RLS correctly hides other WorkGroups from a coach. This controlled RPC is
-- the sole exception: a caller with matches.edit on the target match may see
-- active same-organization players eligible to be borrowed, and nothing else.
create or replace function public.list_match_callup_candidates(p_match_id uuid)
returns table(
  player_id uuid,
  first_name text,
  last_name text,
  birth_year integer,
  source_group_id uuid,
  source_group_name text
)
language plpgsql security definer set search_path = '' as $$
declare target public.matches%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into target from public.matches where id = p_match_id;
  if not found or not private.has_match_permission(target.group_id, 'matches.edit') then
    raise exception 'Permission denied or match not found' using errcode = '42501';
  end if;
  return query
  select distinct on (player.id)
    player.id, player.first_name, player.last_name, player.birth_year,
    assignment.group_id, group_row.name
  from public.group_player_assignments assignment
  join public.team_player_memberships membership
    on membership.id = assignment.team_player_membership_id
  join public.players player on player.id = membership.player_id
  join public.groups group_row on group_row.id = assignment.group_id
  where assignment.organization_id = target.organization_id
    and assignment.status = 'active'
    and membership.status = 'active'
    and player.archived_at is null
    and assignment.group_id <> target.group_id
  order by player.id, assignment.created_at desc;
end;
$$;
alter function public.list_match_callup_candidates(uuid) owner to postgres;
revoke all on function public.list_match_callup_candidates(uuid) from public, anon, authenticated;
grant execute on function public.list_match_callup_candidates(uuid) to authenticated;

commit;
